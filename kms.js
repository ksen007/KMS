var HPage = {};
(function (module) {

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

    function sanitize(divid) {
        return divid.replace(/[^\w\s]/gi, '\\$&');
    }

    function removeSquare(code) {
        if (code.indexOf('[') === 0 && code.lastIndexOf(']') === code.length - 1) {
            return code.substring(1, code.length - 1);
        }
        return code;
    }

    function expand(str) {
        var BEGIN_MARKER = "KMS_INCLUDE(";
        var END_MARKER = ")";
        var BMARKER_LEN = BEGIN_MARKER.length;
        var EMARKER_LEN = END_MARKER.length;

        var sidx, eidx;
        while ((sidx = str.indexOf(BEGIN_MARKER)) >= 0) {
            eidx = str.indexOf(END_MARKER, sidx);
            if (eidx < 0) {
                throw new Error("End marker not found in " + str);
            }
            var code = str.substring(sidx + BMARKER_LEN, eidx);
            var id = 'placeholder-' + Math.floor(Math.random() * 1e10);

            var newCode = '<div id="'+id+'"></div>\x3Cscript type="text/javascript">HPage.loadPage("' + code + '","'+id+'");\x3C/script>';
            str = str.slice(0, sidx) + newCode + str.slice(eidx + EMARKER_LEN);
        }
        return str;
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

    function encrypt(divid, text, key1, key2) {
        if (isEnc(divid)) {
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

    function decrypt(divid, text, key) {
        if (isEnc(divid)) {
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

    function getPass(id) {
        var currVal = $('#'+sanitize(id)).val();
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

    function load(divid, promise, pass, key) {
        var tmp;
        var data = {'file': divid, 'action': 'read', 'password': pass};

        function err() {
            BootstrapDialog.show({
                type: BootstrapDialog.TYPE_WARNING,
                title: 'Error',
                message: 'Cannot read ' + data.file
            });
            console.log("Error");
        }

        console.log("Loading " + data.file + " ... ");
        $.ajax({
            url: module.URL,
            type: 'POST',
            data: data,
            success: function (result) {
                result = $.parseJSON(result);
                if (!result.success) {
                    promise(result.data);
                    console.log("Failure.");
                    console.log(result.message);
                } else {
                    promise(tmp = decrypt(divid, result.data, key));
                    console.log("Success");
                }
            },
            error: err
        })
    }

    function remove(divid, promise, pass) {
        var data = {'file': divid, 'action': 'remove', 'password': pass};

        function err() {
            BootstrapDialog.show({
                type: BootstrapDialog.TYPE_WARNING,
                title: 'Error',
                message: 'Cannot remove ' + data.file
            });
            console.log("Error");
        }

        console.log("Removing " + data.file + " ... ");
        $.ajax({
            url: module.URL,
            type: 'POST',
            data: data,
            success: function (result) {
                result = $.parseJSON(result);
                if (!result.success) {
                    console.log(result.message);
                    err();
                } else {
                    promise('No content');
                    console.log("Success");
                }
            },
            error: err
        })
    }

    function save(file, content, promise, pass, key1, key2) {
        var econtent = encrypt(file, content, key1, key2);

        if (content !== null) {
            var data = {file: file, content: econtent, action: 'write', password: pass};

            function err() {
                BootstrapDialog.show({
                    type: BootstrapDialog.TYPE_WARNING,
                    title: 'Error',
                    message: 'Cannot save ' + data.file
                });
                console.log("Error");
            }

            console.log("Saving " + file + " ... ");
            $.ajax({
                url: module.URL,
                type: 'POST',
                data: data,
                success: function (result) {
                    result = $.parseJSON(result);
                    if (!result.success) {
                        console.log(result.message);
                        err();
                    } else {
                        console.log("Success");
                        console.log(result['data']);
                        promise(content);
                    }
                },
                error: err
            })
        }
    }

    function endsWith(subjectString, searchString, position) {
        if (position === undefined || position > subjectString.length) {
            position = subjectString.length;
        }
        position -= searchString.length;
        var lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
    }

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

    var encString = "***x***";

    function loadPage(divid, parent, nopreview) {
        var parser = getParser(divid);

        var $div;
        $div  = $('<div></div>');
        $('#' + sanitize(parent)).empty().append($div);


        var $buttonEdit = $('<span class="glyphicon glyphicon-edit pull-right" style="padding: 2px;" title="Edit '+divid+'"></span>');
        var $buttonRemove = $('<span class="glyphicon glyphicon-trash pull-right" style="padding: 2px;" title="Delete '+divid+'"></span>');
        var $buttonSave = $('<span class="glyphicon glyphicon-check pull-right" style="padding: 2px;" title="Save '+divid+'"></span>');
        var $buttonCancel = $('<span class="glyphicon glyphicon-remove-circle pull-right" style="padding: 2px;" title="Cancel edit of '+divid+'"></span>');

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

        if(!nopreview) {
            $divhtml = $('\x3Cdiv>\x3C/div>');
            $div.append($divhtml);
        }
        if (!nopreview) $divhtml.html('Loading content ...');

        var editor;

        function switchToPreview() {
            $buttonEdit.show();
            $buttonRemove.show();
            $buttonSave.hide();
            $buttonCancel.hide();

            editor.toTextArea();
            $divtext.hide();
            editor = undefined;
        }

        function saveAction(e) {
            var content = editor.getValue();
            var oldContent = $divtext.data('raw');
            if (content !== oldContent) {
                save(divid, content, function (content) {
                    $divtext.data('raw', content);
                    if (!nopreview) $divhtml.html(parser(content));
                    //if (e !== editor)
                    switchToPreview();
                }, getPass('kms-password'), getPass('kms-key1'), getPass('kms-key2'));
            } else {
                //if (e !== editor)
                switchToPreview();
            }
        }


        function editAction() {
            if ($divtext.data('raw') !== encString) {
                $buttonSave.show();
                $buttonCancel.show();
                $buttonEdit.hide();
                $buttonRemove.hide();
                editor = CodeMirror.fromTextArea($divtext[0], {
                    mode: getMode(divid),
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
                        },
                        "Ctrl-s": saveAction
                    }
                });
                editor.setValue($divtext.data('raw'));
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

        $buttonRemove.click(function () {
                BootstrapDialog.show({
                    title: 'Delete',
                    message: 'Really delete ' + divid + '?',
                    buttons: [{
                        label: 'Delete',
                        action: function (dialog) {
                            remove(divid, function (content) {
                                $divtext.data('raw', content);
                                if (!nopreview) $divhtml.html(parser(content));
                                dialog.close();
                            }, getPass('kms-password'));
                        }
                    }, {
                        label: 'Cancel',
                        action: function (dialog) {
                            dialog.close();
                        }
                    }]
                });
            }
        );

        $buttonCancel.click(function () {
            var content = editor.getValue();
            var oldContent = $divtext.data('raw');
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

        load(divid, function (content) {
            if (content === false) {
                content = "No content";
            }
            if (content === null) {
                content = encString;
            }
            $divtext.data('raw', content);
            if (!nopreview) $divhtml.html(parser(content));
            if (nopreview) editAction();
        }, getPass('kms-password'), getPass('kms-key1'));


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
        console.log("Hashchange "+hash);
        if (hash.indexOf('#!')==0) {
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
            for(k in currentAnchorMap) {
                if (currentAnchorMap.hasOwnProperty(k) && !anchorMap.hasOwnProperty(k)) {
                    $('#'+sanitize(k)).empty();
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
    module.initUploader = initUploader;



    //*********************************
    // API
    //*********************************
    module.loadPage = loadPage;
    module.setAnchorLoadDefault = setAnchorLoadDefault;
    module.anchorLoadChange = anchorLoadChange;
    module.sanitize = sanitize;
    module.URL = "https://apps.eecs.berkeley.edu/~ksen/readwrite.php";


    $(window).bind('hashchange', anchorLoadChange).trigger('hashchange');

}(HPage));
