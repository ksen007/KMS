var KMS = {};
(function (module) {

    var modified = false;
    var contents = {};
    var KMSMAIN = '#kms-main';
    var pagePrefix;
    var SEPARATOR = "<!-- KMS Contents -->";

    var markdown = new Showdown.converter();

    var creole = (function () {
        var creole = new Parse.Simple.Creole();
        var div = $('<div></div>div>');

        return function (str) {
            div.html('');
            creole.parse(div[0], str);
            return div.html();
        }
    }());

    function escapeHtml(string) {
        return string.replace(/\n|\r\n|\r/g, '<br/>').replace(/ /g, '&nbsp;');
    }

    var plugins = {
        '.txt': {
            mode: undefined, converter: function (str) {
                var ret = escapeHtml($('<div>').text(str).html());
                return ret;
            }
        },
        '.md': {
            mode: 'markdown', converter: function (str) {
                return markdown.makeHtml(str);
            }
        },
        '.wiki': {
            mode: undefined, converter: function (str) {
                return creole(str);
            }
        },
        '.js': {
            mode: 'javascript', converter: function (str) {
                return '<script type="text/javascript">' + str + '\x3C/script>';
            }
        },
        '.html': {
            mode: 'text/html', converter: function (str) {
                return str;
            }
        },
        '.css': {
            mode: 'css', converter: function (str) {
                return '\x3Cstyle type = "text/css" > ' + str + '\x3Cstyle>';
            }
        },
        '.php': {
            mode: "application/x-httpd-php", converter: function (str) {
                return '<code> ' + str + '</code>';
            }
        }
    };

    function addPlugin(transformers, mode, converter) {
        plugins[transformers] = {mode: mode, converter: converter};
    }

    function identity(str) {
        return str;
    }

    function getPass(id) {
        var currVal = $('#' + id).val();
        if (currVal !== undefined && currVal.length > 0) {
            localStorage.setItem(id, CryptoJS.AES.encrypt(currVal, id));
            return currVal;
        } else {
            var oldVal = localStorage.getItem(id);
            if (oldVal) {
                var pass = CryptoJS.AES.decrypt(oldVal, id);
                if (pass.sigBytes > 0) {
                    return pass.toString(CryptoJS.enc.Utf8);
                }
            }
            return currVal;
        }
    }


    function getParser(divid) {
        try {
            var pos = divid.lastIndexOf('.');
            if (pos >= 0) {
                var ext = divid.substring(pos);
                return plugins[ext].converter;
            } else {
                return identity;
            }
        } catch (e) {
            return identity;
        }
    }

    function getMode(divid) {
        try {
            var pos = divid.lastIndexOf('.');
            if (pos >= 0) {
                var ext = divid.substring(pos);
                return plugins[ext].mode;
            } else {
                return undefined;
            }
        } catch (e) {
            return undefined;
        }
    }


    function isEnc(divid) {
        var pos = divid.lastIndexOf('.');
        if (pos >= 0) {
            var prefix = divid.substring(0, pos);
            pos = prefix.lastIndexOf('.');
            var ext = prefix.substring(pos);
            return ext === '.enc';
        }
        return false;
    }

    var encString = "***x***";

    function encrypt(content) {
        var text = content.data;
        var transformers = content.transformers;
        var key1 = getPass('kms-key1');
        var key2 = getPass('kms-key2');

        if (isEnc(transformers)) {
            if (key1.length > 0 && key1 === key2) {
                return CryptoJS.AES.encrypt(text, key1).toString();
            } else {
                BootstrapDialog.show({
                    type: BootstrapDialog.TYPE_WARNING,
                    title: 'Error',
                    message: 'Encryption password is either unavailable or there is a mismatch.'
                });
                return null;
            }
        } else {
            return text;
        }
    }

    function decrypt(content) {
        var text = content.data;
        if (text === "") {
            return text;
        }
        var transformers = content.transformers;
        var key = getPass('kms-key1');

        if (isEnc(transformers)) {
            if (key.length > 0) {
                var decrypted = CryptoJS.AES.decrypt(text, key);
                if (decrypted.sigBytes <= 0) {
                    console.log("Decryption failed.");
                    return null;
                }
                return decrypted.toString(CryptoJS.enc.Utf8);
            } else {
                console.log("Password empty or mismatch.");
                return null;
            }
        } else {
            return text;
        }
    }


    function serializeKmsContent(parent) {
        var ret = "";
        var divid = parent.data('default'),
            transformers = contents[divid].transformers,
            creation = contents[divid].creation,
            update = contents[divid].update;
        var parser = getParser(transformers);

        var enc = encrypt(contents[divid]);
        if (enc === null) {
            throw new Error("Failed to encrypt");
        }
        ret = ret +
        '\x3Cdiv id="' + divid +
        '" class="kms-content" data-transformers="' + transformers +
        '" data-creation-time="' + creation +
        '" data-update-time="' + update +
        '">' +
        enc +
        '\x3C/div>\n';

        var $divhtml = $('\x3Cdiv>\x3C/div>');
        $divhtml.html(parser(contents[divid].data));
        $divhtml.find('.kms-location').each(function (i) {
            var dis = $(this);
            ret = ret + serializeKmsContent(dis);
        });
        return ret;
    }

    function serializePage() {
        var ret = pagePrefix;
        ret = ret + SEPARATOR + "\n";
        for (var divid in contents) {
            if (contents.hasOwnProperty(divid)) {
                var content = contents[divid];
                ret = ret +
                '\x3Cdiv id="' + divid +
                '" class="kms-content" data-transformers="' + content.transformers +
                '" data-creation-time="' + content.creation +
                '" data-update-time="' + content.update +
                '">' +
                content.data +
                '\x3C/div>\n\n<!-- SEPARATOR -->\n';
            }
        }
        ret = ret + '</body>\n</html>\n';
        return ret;
    }

    function saveerr(file) {
        BootstrapDialog.show({
            type: BootstrapDialog.TYPE_WARNING,
            title: 'Error',
            message: 'Cannot save ' + file
        });
        console.log("Error");
    }


    function savePageAux(file, str) {
        var data = {file: file, content: str, action: 'write', password: getPass('kms-password')};

        console.log("Saving " + file + " ... ");
        $.ajax({
            url: module.URL,
            type: 'POST',
            data: data,
            success: function (result) {
                result = $.parseJSON(result);
                if (!result.success) {
                    console.log(result.message);
                    saveerr(file);
                } else {
                    console.log("Success");
                    console.log(result['data']);
                    BootstrapDialog.show({
                        message: 'Successfully saved ' + data.file
                    });
                }
            },
            error: function () {
                saveerr(file);
            }
        })

    }

    function loadTemplate(promise) {
        function err() {
            BootstrapDialog.show({
                type: BootstrapDialog.TYPE_WARNING,
                title: 'Error',
                message: 'Cannot read ' + document.location.href
            });
            console.log("Error");
        }

        $.ajax({
            url: document.location.href,
            type: 'GET',
            success: function (result) {
                pagePrefix = result.substring(0, result.indexOf(SEPARATOR));
                promise();
            },
            error: err
        })
    }

    function savePage2() {
        var parser = document.createElement('a');
        parser.href = document.location.href;
        var file = parser.pathname.substring(1);
        if (file.indexOf('~') === 0) {
            file = file.substring(file.indexOf('/') + 1);
        }

        var econtent;
        econtent = serializePage();
        savePageAux(file, econtent);
    }


    function newPage2() {
        var ret = pagePrefix;
        ret = ret + SEPARATOR + "\n";
        ret = ret + '</body>\n</html>\n';
        savePageAux($('#kms-file').val(), ret);
    }

    function savePage() {
        loadTemplate(savePage2);
    }

    function newPage() {
        loadTemplate(newPage2);
    }

    function loadSubKmsContents(div) {
        var transformers = div.data('transformers');
        if (transformers === undefined) {
            transformers = ".html"
        }
        loadKmsContent(div.data('default'), transformers, div);
    }

    function setContent(parent, divid, $divhtml, parser) {
        var content = decrypt(contents[divid]);
        if (content === null) {
            content = encString;
        }

        $divhtml.html(parser(content));
        parent.find('.kms-script').each(function (i) {
            var dis = $(this);
            parent.append($('<script type="text/javascript">' + dis.text() + '</script>'));
        });
        parent.find('.kms-location').each(function (i) {
            var dis = $(this);
            loadSubKmsContents(dis);
        });
    }


    function loadKmsContent(divid, transformers, parent) {
        if (divid === undefined) return;

        var data = contents[divid];
        if (data === undefined) {
            data = {data: "", transformers: transformers, creation: Date.now(), update: Date.now()};
            contents[divid] = data;
        }
        transformers = data.transformers ? data.transformers : transformers;

        var parser = getParser(transformers);

        var $div;
        $div = $('<div></div>');
        parent.empty().append($div);


        var $buttonEdit = $('<span class="glyphicon glyphicon-edit pull-right" style="padding: 2px;" title="Edit ' + divid + '"></span>');
        var $buttonRemove = $('<span class="glyphicon glyphicon-plus pull-right" style="padding: 2px;" title="Add sub element ' + divid + '"></span>');
        var $buttonSave = $('<span class="glyphicon glyphicon-check pull-right" style="padding: 2px;" title="Save ' + divid + '"></span>');
        var $buttonCancel = $('<span class="glyphicon glyphicon-remove-circle pull-right" style="padding: 2px;" title="Cancel edit of ' + divid + '"></span>');

        $div.append($buttonCancel);
        $buttonCancel.hide();
        $div.append($buttonSave);
        $buttonSave.hide();
        $div.append($buttonRemove);
        $div.append($buttonEdit);

        $div.append($('<p>'));

        var $divtext = $('<textarea></textarea>');
        $div.append($divtext);
        $divtext.hide();

        var $divhtml;

        $divhtml = $('\x3Cdiv>\x3C/div>');
        $div.append($divhtml);
        $divhtml.html('Loading content ...');

        var editor;

        function switchToPreview() {
            $buttonEdit.show();
            $buttonRemove.show();
            $buttonSave.hide();
            $buttonCancel.hide();

            editor.toTextArea();
            $divtext.hide();
            $divhtml.show();
            editor = undefined;
        }

        function prependAction(e) {
            var dec = decrypt((contents[divid]));
            if (dec !== null) {
                modified = true;
                var cls = $divhtml.children('.kms-location').first().data('transformers');
                dec = '\x3Cdiv class="kms-location" data-transformers="' + cls + '" data-default="x' + Math.random().toString(36).substring(7) + '">\x3C/div>\n' + dec;

                contents[divid].data = dec;
                contents[divid].update = Date.now();
                var enc = encrypt(contents[divid]);
                if (enc === null) {
                    return;
                }
                contents[divid].data = enc;
                setContent(parent, divid, $divhtml, parser);
            } else {
                BootstrapDialog.show({
                    type: BootstrapDialog.TYPE_WARNING,
                    title: 'Warning',
                    message: 'Cannot edit encrypted data before decryption.'
                });
            }
        }

        function saveAction(e) {
            var content = editor.getValue();
            modified = true;
            contents[divid].data = content;
            contents[divid].update = Date.now();
            var enc = encrypt(contents[divid]);
            if (enc === null) {
                return;
            }
            contents[divid].data = enc;


            setContent(parent, divid, $divhtml, parser);
            switchToPreview();
        }

        function editAction() {
            var dec = decrypt((contents[divid]));
            if (dec !== null) {
                $buttonSave.show();
                $buttonCancel.show();
                $buttonEdit.hide();
                $buttonRemove.hide();
                $divhtml.hide();
                editor = CodeMirror.fromTextArea($divtext[0], {
                    mode: getMode(transformers),
                    theme: "default",
                    lineWrapping: true,
                    matchBrackets: true,
                    indentUnit: 4,
                    indentWithTabs: true,
                    extraKeys: {
                        "Ctrl-Enter": function (cm) {
                            cm.setOption("fullScreen", !cm.getOption("fullScreen"));
                        },
                        "Esc": function (cm) {
                            if (cm.getOption("fullScreen")) cm.setOption("fullScreen", false);
                        }
                    }
                });
                editor.setValue(dec);
            } else {
                BootstrapDialog.show({
                    type: BootstrapDialog.TYPE_WARNING,
                    title: 'Warning',
                    message: 'Cannot edit encrypted data before decryption.'
                });
            }
        }


        function cancelAction() {
            var content = editor.getValue();
            var oldContent = contents[divid].data;
            if (content === oldContent) {
                switchToPreview();
            } else {
                BootstrapDialog.show({
                    type: BootstrapDialog.TYPE_WARNING,
                    title: 'Close',
                    message: 'Content modified. Really close?',
                    buttons: [{
                        label: 'Close',
                        action: function (dialog) {
                            dialog.close();
                            switchToPreview();
                        }
                    }, {
                        label: 'Cancel',
                        action: function (dialog) {
                            dialog.close();
                        }
                    }]
                });
            }
        }

        $buttonEdit.click(editAction);
        $buttonSave.click(saveAction);
        $buttonCancel.click(cancelAction);
        $buttonRemove.click(prependAction);


        setContent(parent, divid, $divhtml, parser);
    }

    function loadKmsContentFromTag(dividtransformers, parentDiv) {
        var divid = dividtransformers.substring(0, dividtransformers.indexOf("."));
        var transformers = dividtransformers.substring(dividtransformers.indexOf("."));
        parentDiv = $('#' + parentDiv);
        loadKmsContent(divid, transformers, parentDiv);
    }

    var currentAnchorMap = {};
    var anchorLoadDefault = '';

    function setAnchorLoadDefault(s) {
        currentAnchorMap = {};
        anchorLoadDefault = s;
    }


    function anchorLoadChange() {
        var hash = window.location.hash, k;
        if (hash === '') {
            hash = anchorLoadDefault;
        }
        console.log("Hashchange " + hash);
        if (hash.indexOf('#!') == 0) {
            hash = hash.substring(2);
            var anchorMap = {};
            var kvs = hash.split('&');
            for (var i = 0; i < kvs.length; i++) {
                var kv = kvs[i].split('=');
                anchorMap[kv[0]] = kv[1];
            }

            for (k in anchorMap) {
                if (anchorMap.hasOwnProperty(k)) {
                    if (currentAnchorMap[k] !== anchorMap[k]) {
                        loadKmsContentFromTag(anchorMap[k], k);
                    }
                }
            }
            for (k in currentAnchorMap) {
                if (currentAnchorMap.hasOwnProperty(k) && !anchorMap.hasOwnProperty(k)) {
                    $('#' + k).empty();
                }
            }
            currentAnchorMap = anchorMap;
        }
    }


    function initUploader() {
        $("#kms-drop-area-div").dmUploader({
            url: module.URL,
            extraData: {
                'action': 'upload', get directory() {
                    return $('#kms-file').val();
                }, get password() {
                    return getPass('kms-password');
                }
            },
            fileName: 'uploaded',
            onInit: function () {
                console.log('Plugin successfully initialized');
            },
            onUploadSuccess: function (id, data) {
                data = $.parseJSON(data);

                var outcome = data.success;
                if (outcome) {
                    console.log('Successfully upload #' + id);
                    console.log('Server response was:');
                    console.log(data.message);
                    BootstrapDialog.show({
                        message: 'Successfully uploaded. '
                    });
                } else {
                    console.log(data.message);
                    BootstrapDialog.show({
                        type: BootstrapDialog.TYPE_WARNING,
                        message: 'Upload failed. '
                    });
                }
            },
            onComplete: function () {
                console.log('We reach the end of the upload Queue!');
            }
        });
    }

    function collectContents() {
        $('.kms-content').each(
            function (i) {
                var tmp = $(this);
                contents[this.id] = {
                    data: _.unescape(tmp.html()),
                    transformers: tmp.data('transformers'),
                    creation: tmp.data('creation-time'),
                    update: tmp.data('update-time')
                };
            }
        );
    }


    $(document).ready(function () {
            console.log("Populating page");
            initUploader();
            collectContents();
            $(window).bind('hashchange', anchorLoadChange).trigger('hashchange');
            loadSubKmsContents($(KMSMAIN));
        }
    );

    //*********************************
    // API
    //*********************************
    module.setAnchorLoadDefault = setAnchorLoadDefault;
    module.anchorLoadChange = anchorLoadChange;
    module.savePage = savePage;
    module.newPage = newPage;
    module.addPlugin = addPlugin;
    module.URL = "https://apps.eecs.berkeley.edu/~ksen/readwrite.php";

}(KMS));