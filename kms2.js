var KMS = {};
(function (module) {

    var modified = false;
    var contents = {};

    var plugins = {
        '.txt': {
            mode: undefined, converter: function (str) {
                var ret = escapeHtml($('<div>').text(str).html());
                return ret;
            }
        },
        '.md': {
            mode: 'markdown', converter: function (str) {
                return expand(markdown.makeHtml(str));
            }
        },
        '.wiki': {
            mode: undefined, converter: function (str) {
                return expand(creole(str));
            }
        },
        '.js': {
            mode: 'javascript', converter: function (str) {
                return '<script type="text/javascript">' + str + '\x3C/script>';
            }
        },
        '.html': {
            mode: 'text/html', converter: function (str) {
                return expand(str);
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

    function encrypt(transformers, text, key1, key2) {
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

    function decrypt(transformers, text, key) {
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


    var encString = "***x***";

    function loadDivid(divid, transformers, parent, nopreview) {
        var data = contents[divid];
        if (data === undefined) {
            data = {data: "No content", transformers: transformers};
        }
        contents[divid] = data;
        transformers = data.transformers;

        var parser = getParser(transformers);

        var $div;
        $div = $('<div></div>');
        parent.empty().append($div);


        var $buttonEdit = $('<span class="glyphicon glyphicon-edit pull-right" style="padding: 2px;" title="Edit ' + divid + '"></span>');
        var $buttonRemove = $('<span class="glyphicon glyphicon-trash pull-right" style="padding: 2px;" title="Delete ' + divid + '"></span>');
        var $buttonSave = $('<span class="glyphicon glyphicon-check pull-right" style="padding: 2px;" title="Save ' + divid + '"></span>');
        var $buttonCancel = $('<span class="glyphicon glyphicon-remove-circle pull-right" style="padding: 2px;" title="Cancel edit of ' + divid + '"></span>');

        $div.append($buttonCancel);
        $buttonCancel.hide();
        $div.append($buttonSave);
        $buttonSave.hide();
        $div.append($buttonRemove);
        $div.append($buttonEdit);

        $div.append($('<br>'));

        var $divtext = $('<textarea></textarea>');
        $div.append($divtext);
        $divtext.hide();

        var $divhtml;

        if (!nopreview) {
            $divhtml = $('\x3Cdiv>\x3C/div>');
            $div.append($divhtml);
        }
        if (!nopreview) $divhtml.html('Loading content ...');

        var editor;

        function setContent(content) {
            $divhtml.html(parser(content));
            parent.find('.kms-location').each(function (i) {
                var dis = $(this);
                populate(dis);
            })
        }

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

        function saveAction(e) {
            var content = editor.getValue();
            var oldContent = contents[divid].data;
            if (content !== oldContent) {
                modified = true;
                contents[divid].data = content;
                if (!nopreview) {
                    setContent(content);
                }
                switchToPreview();
            } else {
                switchToPreview();
            }
        }

        function editAction() {
            if (contents[divid].data !== encString) {
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
                editor.setValue(contents[divid].data);
            } else {
                BootstrapDialog.show({
                    type: BootstrapDialog.TYPE_WARNING,
                    title: 'Warning',
                    message: 'Cannot edit encrypted data before decryption.'
                });
            }
        }

        $buttonEdit.click(editAction);
        $buttonSave.click(saveAction);


        $buttonCancel.click(function () {
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
        });

        var content = decrypt(divid, data.data, getPass('kms-key1'));
        if (content === null) {
            content = encString;
        }
        if (!nopreview) {
            setContent(content);
        }
        if (nopreview) editAction();
    }

    function loadPage(dividtransformers, parent, nopreview) {
        var divid = dividtransformers.substring(0, dividtransformers.indexOf("."));
        var transformers = dividtransformers.substring(dividtransformers.indexOf("."));
        parent = $('#' + parent);
        loadDivid(divid, transformers, parent, nopreview);
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
                        loadPage(anchorMap[k], k);
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

    var pagePrefix;
    var SEPARATOR = "<!-- KMS Contents -->";

    function populate(div) {
        loadDivid(div.data('default'), div.data('transformers'), div);
    }

    function collectContents() {
        $('.kms-content').each(
            function (i) {
                var tmp = $(this);
                contents[this.id] = {data: tmp.html(), transformers: tmp.data('transformers')};
            }
        );
    }


    $(document).ready(function () {
            console.log("Populating page");
            initUploader();
            $(window).bind('hashchange', anchorLoadChange).trigger('hashchange');
            collectContents();
            pagePrefix = $('html')[0].outerHTML;
            pagePrefix = pagePrefix.substring(0, pagePrefix.indexOf(SEPARATOR));
            populate($('#kms-main'));
        }
    );

    //*********************************
    // API
    //*********************************
    module.loadPage = loadPage;
    module.setAnchorLoadDefault = setAnchorLoadDefault;
    module.anchorLoadChange = anchorLoadChange;
    module.URL = "https://apps.eecs.berkeley.edu/~ksen/readwrite.php";

}(KMS));