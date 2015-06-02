var KMS = {};
(function (module) {

    var modified = false;
    var contents = {};
    var KMSMAIN = '#kms-main';
    var pagePrefix;
    var SEPARATOR = "<!-- KMS Contents -->";
    var encString = "***x***";

    /********************************************************************/

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

    /********************************************************************/

    function isEnc(transformers) {
        var pos = transformers.lastIndexOf('.');
        if (pos >= 0) {
            var prefix = transformers.substring(0, pos);
            pos = prefix.lastIndexOf('.');
            var ext = prefix.substring(pos);
            return ext === '.enc';
        }
        return false;
    }


    function encrypt(text, type) {
        var key1 = getPass('kms-key1');
        var key2 = getPass('kms-key2');

        if (isEnc(type)) {
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

    function decrypt(text, type) {
        if (text === "") {
            return text;
        }
        var key = getPass('kms-key1');

        if (isEnc(type)) {
            if (key.length > 0) {
                var decrypted = CryptoJS.AES.decrypt(text, key);
                if (decrypted.sigBytes <= 0) {
                    console.log("Decryption failed.");
                    return null;
                }
                return decrypted.toString(CryptoJS.enc.Utf8);
            } else {
                console.log("Password empty or mismatch.");
                return encString;
            }
        } else {
            return text;
        }
    }

    /*******************************************************************
     * Plugin related functions
     */

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

    function identity(str) {
        return str;
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

    function setPlugin(type, mode, converter) {
        plugins[type] = {mode: mode, converter: converter};
    }

    function getPlugin(type) {
        return plugins[type];
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


    /********************************************************************/

    function refreshContent(container) {
        var contentid = container.data('content');
        var type = container.data('type') || ".html";
        var content = Content.getContent(contentid, type);
        var text = content.getText();

        var html, interHtml, oldTransformer;
        interHtml = getParser(content.getType())(text, content);
        oldTransformer = content.getTransformer();

        html = oldTransformer(interHtml);
        html = html.replace(/{{THISCONTENT}}/g, "KMS.Content.getContent('" + contentid + "','" + type + "')");
        container.html(html);
        if (content.getTransformer() !== oldTransformer) {
            html = content.getTransformer(interHtml);
            html = html.replace(/{{THISCONTENT}}/g, "KMS.Content.getContent('" + contentid + "','" + type + "')");
            container.html(html);
        }

        container.find('.kms-location').each(function (i) {
            var dis = $(this);
            refreshContent(dis);
        });
    }


    function Content(id, text, transformer, type, creationTime, updateTime) {
        this.id = id;
        this.text = text.replace(/&lt;(\/textarea>)/gi, "<$1");
        this.transformer = transformer;
        this.type = type;
        this.creationTime = creationTime;
        this.updateTime = updateTime;
    }

    Content.defaultTransformer = function (text) {
        var prefix =
            '<span class="glyphicon glyphicon-remove-circle pull-right" style="padding: 2px; display: none;" title="Cancel edit"  onclick="KMS.cancelAction(this,{{THISCONTENT}})"></span>' +
            '<span class="glyphicon glyphicon-check pull-right" style="padding: 2px; display: none;" title="Save"  onclick="KMS.saveAction(this,{{THISCONTENT}})"></span>' +
            '<span class="glyphicon glyphicon-edit pull-right" style="padding: 2px;" title="Edit" onclick="KMS.editAction(this,{{THISCONTENT}})"></span>' +
            '<textarea style="display: none"></textarea>' +
            '<div>';
        var suffix = '</div>';
        return prefix + text + suffix;
    };

    Content.getContent = function (id, type) {
        var content = contents[id];
        if (!content) {
            contents[id] = content = new Content(id, "", Content.defaultTransformer, type, Date.now(), Date.now());
        }
        return content;
    };

    Content.prototype.getText = function () {
        return decrypt(this.text, this.type);
    };

    Content.prototype.getType = function () {
        return this.type;
    };

    Content.prototype.setText = function (text) {
        text = encrypt(text, this.type);
        if (text !== null) {
            this.text = text;
            this.updateTime = Date.now();
            $("div[data-content='" + this.id + "']").each(function (i) {
                refreshContent($(this));
            });
            return true;
        }
        return false;
    };

    Content.prototype.getTransformer = function () {
        return this.transformer;
    };

    Content.prototype.setTransformer = function (transformer) {
        this.transformer = transformer;
    };

    Content.prototype.getCreationTime = function () {
        return this.creationTime;
    };

    Content.prototype.getUpdateTime = function () {
        return this.updateTime;
    };

    Content.prototype.getId = function () {
        return this.id;
    };

    Content.prototype.serialize = function () {
        return '\x3Ctextarea id="' + this.getId() +
            '" class="kms-content" data-type="' + this.getType() +
            '" data-creation-time="' + this.getCreationTime() +
            '" data-update-time="' + this.getUpdateTime() +
            '">' +
            this.text.replace(/<(\/textarea>)/gi, '&lt;$1') +
            '\x3C/textarea>\n\n<!-- SEPARATOR -->\n';
    };

    /********************************************************************/


    function serializePage() {
        var ret = pagePrefix;
        ret = ret + SEPARATOR + "\n";
        for (var divid in contents) {
            if (contents.hasOwnProperty(divid)) {
                var content = contents[divid];
                ret = ret + content.serialize();
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

    function getCurrentFileName() {
        var parser = document.createElement('a');
        parser.href = document.location.href;
        var file = parser.pathname.substring(1);
        if (file.indexOf('~') === 0) {
            file = file.substring(file.indexOf('/') + 1);
        }
        return file;
    }

    function savePage2() {
        var file = getCurrentFileName();
        var econtent;
        econtent = serializePage();
        savePageAux(file, econtent);
    }


    function download2() {
        var text = serializePage();
        var filename = getCurrentFileName();
        var pom = document.createElement('a');
        pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        pom.setAttribute('download', filename);

        pom.style.display = 'none';
        document.body.appendChild(pom);

        pom.click();

        document.body.removeChild(pom);
    }


    function newPage2() {
        var ret = pagePrefix;
        ret = ret + SEPARATOR + "\n";
        ret = ret + '</body>\n</html>\n';
        savePageAux($('#kms-file').val(), ret);
    }

    function download() {
        loadTemplate(download2);
    }

    function savePage() {
        loadTemplate(savePage2);
    }

    function newPage() {
        loadTemplate(newPage2);
    }

    module.savePage = savePage;
    module.newPage = newPage;
    module.download = download;

    /********************************************************************/

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
                        var container = $('#'+k);
                        var idtype = anchorMap[k];
                        var id = idtype.substring(0, idtype.indexOf("."));
                        var type = idtype.substring(idtype.indexOf("."));

                        container.data('content', id);
                        container.data('type', type);

                        refreshContent(container);
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

    /********************************************************************/

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

    /********************************************************************/

    function saveAction(e, content) {
        var siblings = $(e).siblings();
        var $buttonCancel = $(siblings[0]);
        var $buttonSave = $(e);
        var $buttonEdit = $(siblings[1]);
        var $divtext = $(siblings[2]);
        var $divhtml = $(siblings[4]);
        var editor = $divtext[0].editor;

        if (content.setText(editor.getValue())) {
            $buttonEdit.show();
            $buttonSave.hide();
            $buttonCancel.hide();
            editor.toTextArea();
            $divtext.hide();
            $divhtml.show();
            $divtext[0].editor = undefined;
        }
    }

    function editAction(e, content) {
        var dec = content.getText();
        if (dec !== encString) {
            var siblings = $(e).siblings();
            var $buttonCancel = $(siblings[0]);
            var $buttonSave = $(siblings[1]);
            var $buttonEdit = $(e);
            var $divtext = $(siblings[2]);
            var $divhtml = $(siblings[3]);


            $buttonSave.show();
            $buttonCancel.show();
            $buttonEdit.hide();
            $divhtml.hide();
            var editor = CodeMirror.fromTextArea($divtext[0], {
                mode: getMode(content.getType()),
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
            $divtext[0].editor = editor;
            editor.setValue(dec);
        } else {
            BootstrapDialog.show({
                type: BootstrapDialog.TYPE_WARNING,
                title: 'Warning',
                message: 'Cannot edit encrypted data before decryption.'
            });
        }
    }


    function cancelAction(e, content) {
        var siblings = $(e).siblings();
        var $buttonCancel = $(e);
        var $buttonSave = $(siblings[0]);
        var $buttonEdit = $(siblings[1]);
        var $divtext = $(siblings[2]);
        var $divhtml = $(siblings[4]);
        var editor = $divtext[0].editor;

        var text = editor.getValue();
        var oldText = content.getText();
        if (text === oldText) {
            $buttonEdit.show();
            $buttonSave.hide();
            $buttonCancel.hide();
            editor.toTextArea();
            $divtext.hide();
            $divhtml.show();
            $divtext[0].editor = undefined;
        } else {
            BootstrapDialog.show({
                type: BootstrapDialog.TYPE_WARNING,
                title: 'Close',
                message: 'Content modified. Really close?',
                buttons: [{
                    label: 'Close',
                    action: function (dialog) {
                        dialog.close();
                        $buttonEdit.show();
                        $buttonSave.hide();
                        $buttonCancel.hide();
                        editor.toTextArea();
                        $divtext.hide();
                        $divhtml.show();
                        $divtext[0].editor = undefined;
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

    module.editAction = editAction;
    module.saveAction = saveAction;
    module.cancelAction = cancelAction;

    /********************************************************************/

    function collectContents() {
        $('.kms-content').each(
            function (i) {
                var tmp = $(this);
                contents[this.id] = new Content(
                    this.id,
                    tmp.text(),
                    Content.defaultTransformer,
                    tmp.data('type'),
                    tmp.data('creation-time'),
                    tmp.data('update-time')
                );
            }
        );
    }

    /********************************************************************/

    $(document).ready(function () {
            console.log("Populating page");
            initUploader();
            collectContents();
            $(window).bind('hashchange', anchorLoadChange).trigger('hashchange');
            refreshContent($(KMSMAIN));
            var hash = window.location.hash;
            if (hash !== '') {
                anchorLoadChange();
            }
        }
    );


    /********************************************************************/
    /***************************  API  **********************************/
    /********************************************************************/
    module.Content = Content;
    module.setPlugin = setPlugin;
    module.getPlugin = getPlugin;

}(KMS));