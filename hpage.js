var HPage = {};
(function (module) {

    module.URL = "https://apps.eecs.berkeley.edu/~ksen/readwrite.php";

    var markdown = new Showdown.converter();

    var creole = (function() {
        var creole = new Parse.Simple.Creole();
        var div = $('<div></div>div>');

        return function(str) {
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
            var divid = removeSquare(code);
            var newCode = '<div id="' + divid + '" ></div>\x3Cscript type="text/javascript">HPage.loadPage("' + code + '");\x3C/script>';
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

    function encrypt(divid, text) {
        var pass;
        if (isEnc(divid)) {
            if ((pass = $('#kms-key1').val()).length > 0 && pass === $('#kms-key2').val()) {
                return CryptoJS.AES.encrypt(text,pass).toString();
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

    function decrypt(divid, text) {
        var pass;
        if (isEnc(divid)) {
            if ((pass = $('#kms-key1').val()).length > 0 && pass === $('#kms-key2').val()) {
                var decrypted = CryptoJS.AES.decrypt(text, pass);
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

    function load(divid, promise) {
        var tmp, pass;
        var data = {'file': divid, 'action': 'read'};

        // someone is trying access file outside the safe zone
        // need to check password
        if (divid.indexOf('..')>=0 || divid.indexOf('/')==0) {
            pass = $('#kms-password').val();
            data.password = (pass?pass:"");
        }

        console.log("Loading " + data.file + " ... ");
        $.ajax({
            url: module.URL,
            type: 'POST',
            data: data,
            dataType: 'json',
            success: function (result) {
                promise(tmp = decrypt(divid, result['data']));
                console.log("Success");
            },
            error: function () {
                BootstrapDialog.show({
                    type: BootstrapDialog.TYPE_WARNING,
                    title: 'Error',
                    message: 'Cannot read ' + data.file
                });
                console.log("Error");
            }
        })
    }

    function remove(divid, promise) {
        var data = {'file': divid, 'action': 'remove', 'password': $('#kms-password').val()};

        console.log("Removing " + data.file + " ... ");
        $.ajax({
            url: module.URL,
            type: 'POST',
            data: data,
            dataType: 'json',
            success: function (result) {
                promise('No content');
                console.log("Success");
            },
            error: function () {
                BootstrapDialog.show({
                    type: BootstrapDialog.TYPE_WARNING,
                    title: 'Error',
                    message: 'Cannot remove ' + data.file
                });
                console.log("Error");
            }
        })
    }

    function save(file, content, promise) {
        var econtent = encrypt(file, content);

        if (content !== null) {
            var data = {file: file, content: econtent, action: 'write', 'password': $('#kms-password').val()};
            console.log("Saving " + file + " ... ");
            $.ajax({
                url: module.URL,
                type: 'POST',
                data: data,
                dataType: 'json',
                success: function (result) {
                    console.log("Success");
                    console.log(result['data']);
                    promise(content);
                },
                error: function () {
                    BootstrapDialog.show({
                        type: BootstrapDialog.TYPE_WARNING,
                        title: 'Error',
                        message: 'Cannot save ' + data.file
                    });
                    console.log("Error");
                }
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
        } catch(e) {
            return undefined;
        }
    }

    function identity(str) {
        return str;
    };

    function getParser(divid) {
        try {
            var pos = divid.lastIndexOf('.');
            if (pos >= 0) {
                var ext = divid.substring(pos);
                return plugins[ext].converter;
            } else {
                return identity;
            }
        } catch(e) {
            return identity;
        }
    }

    var encString = "***Encrypted data***";

    module.loadPage = function (divid, nopreview, previous) {
        var isBoxed = false;
        var oldDivid = divid, tmp;
        divid = removeSquare(oldDivid);
        if (divid !== oldDivid) {
            isBoxed = true;
        }

        tmp = $('#' + sanitize(divid));
        if (!tmp.length) {
            tmp = $('<div></div>');
            tmp.attr('id', divid);
            if (previous !== undefined) {
                $('#'+sanitize(previous)).after(tmp);
            } else {
                $('script').last().after(tmp);
            }
        }

        if (!$('#' + sanitize(divid + '.top')).length) {
            var parser = getParser(divid);

            var $div = $('\x3Cdiv id="' + divid + '.top" ' + (isBoxed ? 'class="panel panel-default"' : '') + ' style="padding: 1em;">\x3C/div>');
            tmp.append($div);


            var $buttonEdit = $('<span id="' + divid + '.edit" class="glyphicon glyphicon-edit pull-right" style="padding-right: 5px;"></span>');
            var $buttonRemove = $('<span id="' + divid + '.remove" class="glyphicon glyphicon-trash pull-right" style="padding-right: 5px;"></span>');
            var $buttonSave = $('<span id="' + divid + '.save" class="glyphicon glyphicon-check pull-right" style="padding-right: 5px;"></span>');
            var $buttonCancel = $('<span id="' + divid + '.cancel" class="glyphicon glyphicon-remove-circle pull-right" style="padding-right: 5px;"></span>');

            $div.append($buttonCancel);
            $buttonCancel.hide();
            $div.append($buttonSave);
            $buttonSave.hide();
            $div.append($buttonRemove);
            $div.append($buttonEdit);

            $div.append($('<br>'));

            var $divtext = $('<textarea id="' + divid + '.text"></textarea>');
            $div.append($divtext);
            $divtext.hide();

            var $divhtml = $('\x3Cdiv id = "' + divid + '.html" >\x3C/div>');
            $div.append($divhtml);
            if (!nopreview) $divhtml.html('Loading content ...');

            var editor;

            load(divid, function (content) {
                if (content === false) {
                    content = "No content";
                }
                if (content === null) {
                    content = encString;
                }
                $divtext.data('raw', content);
                if (!nopreview) $divhtml.html(parser(content));
            });

            function switchToPreview() {
                $buttonEdit.show();
                $buttonRemove.show();
                $buttonSave.hide();
                $buttonCancel.hide();

                editor.toTextArea();
                $divtext.hide();
                editor = undefined;
            }

            $buttonEdit.click(function () {
                if ($divtext.data('raw')!==encString) {
                    $buttonSave.show();
                    $buttonCancel.show();
                    $buttonEdit.hide();
                    $buttonRemove.hide();
                    editor = CodeMirror.fromTextArea($divtext[0], {
                        mode: getMode(divid),
                        theme: "default",
                        extraKeys: {
                            "Ctrl-Enter": function (cm) {
                                cm.setOption("fullScreen", !cm.getOption("fullScreen"));
                            },
                            "Esc": function (cm) {
                                if (cm.getOption("fullScreen")) cm.setOption("fullScreen", false);
                            }
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
            });

            $buttonSave.click(function () {
                    var content = editor.getValue();
                    var oldContent = $divtext.data('raw');
                    if (content !== oldContent) {
                        save(divid, content, function (content) {
                            $divtext.data('raw', content);
                            if (!nopreview) $divhtml.html(parser(content));
                            switchToPreview();
                        });
                    } else {
                        switchToPreview();
                    }
                }
            );

            $buttonRemove.click(function () {
                    BootstrapDialog.show({
                        title: 'Delete',
                        message: 'Really delete '+divid+'?',
                        buttons: [{
                            label: 'Delete',
                            action: function (dialog) {
                                remove(divid, function (content) {
                                    $divtext.data('raw', content);
                                    if (!nopreview) $divhtml.html(parser(content));
                                    dialog.close();
                                });
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
        }
    };

    module.loadLastDivPage = function () {
        var currentScript = $('script').last();
        var divid = currentScript.prev().attr('id');
        module.loadPage(divid);
    };


    module.unloadPage = function (divid) {
        divid = removeSquare(divid);
        var tmp = $('#' + sanitize(divid + '.top'));
        if (tmp.length) {
            tmp.remove();
        }
    }

    module.toggleCollapse = function(str) {
        var $collapse = $('#'+sanitize(str));
        $collapse.collapse('toggle');
    };

}(HPage));
