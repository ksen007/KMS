var KMS = {};
(function (module) {

    var modified = false;
    var contents = {};
    var isContentsEncrypted = true;
    var KMSMAIN = '#kms-main';
    var pagePrefix;
    var SEPARATOR = "<!-- KMS Contents -->";
    var encString = "***x***";


    var queryMap = {};

    function parseQuery() {
        var query = window.location.search;
        if (typeof query === "string" && query.indexOf("?") === 0) {
            query = query.substring(1);
            var vars = query.split('&');
            for (var i = 0; i < vars.length; i++) {
                var pair = vars[i].split('=');
                if (pair[0] !== '') {
                    queryMap[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
                }
            }
        }
    }

    function encodeQuery(key, value) {
        var ret = "";
        var old = queryMap[key];
        queryMap[key] = value;
        for (var prop in queryMap) {
            // skip loop if the property is from prototype
            if (!queryMap.hasOwnProperty(prop)) continue;
            if (ret === "") {
                ret = "?";
            } else {
                ret += "&";
            }
            ret += encodeURIComponent(prop) + "=" + encodeURIComponent(queryMap[prop]);
        }
        if (old === undefined) {
            delete queryMap[key];
        } else {
            queryMap[key] = old;
        }
        return ret;
    }


    /********************************************************************/

    function loadScriptsOnce(scriptList, globalVar, cb) {
        if ((typeof globalVar === "string" && typeof window[globalVar] === 'undefined') || globalVar) {

            function getScript(url, success) {
                var script = document.createElement('script');
                script.src = url;
                var head = document.getElementsByTagName('head')[0],
                    done = false;

                script.onload = script.onreadystatechange = function () {
                    if (!done && (!this.readyState || this.readyState == 'loaded' || this.readyState == 'complete')) {
                        done = true;
                        script.onload = script.onreadystatechange = null;
                        head.removeChild(script);
                        success();
                    }

                };
                head.appendChild(script);
            }

            function getScriptAt(sList, i, success) {
                if (i === sList.length) {
                    success();
                } else {
                    getScript(sList[i], function () {
                        getScriptAt(sList, i + 1, success);
                    })
                }
            }

            getScriptAt(scriptList, 0, cb);

        } else {
            cb();
        }
    }

    /********************************************************************/
    var pCounter = 2;

    function getPass(id) {
        var href = window.location.origin + window.location.pathname;
        var key = href + ":" + id;
        var iddiv = document.getElementById(id);
        var currVal;
        if (iddiv) {
            currVal = iddiv.value;
        } else {
            currVal = "";
        }
        if (currVal !== undefined && currVal.length > 0) {
            id = id + "2";
            localStorage.setItem(key, CryptoJS.AES.encrypt(currVal, id));
            return currVal;
        } else {
            var oldVal = localStorage.getItem(key);
            if (oldVal && pCounter === 2) {
                var pass = CryptoJS.AES.decrypt(oldVal, id + (pCounter));
                if (pass.sigBytes > 0) {
                    var clearPass = pass.toString(CryptoJS.enc.Utf8);
                    if (iddiv)
                        document.getElementById(id).value = clearPass;
                    return clearPass;
                }
            }
            return currVal;
        }
    }


    function getNewPass(oldPass) {
        var newVal1 = document.getElementById("kms-password-new1").value;
        var newVal2 = document.getElementById("kms-password-new2").value;
        if (newVal1 !== undefined && newVal1.length > 0) {
            if (newVal1 === newVal2) {
                return newVal1;
            } else {
                BootstrapDialog.show({
                    type: BootstrapDialog.TYPE_WARNING,
                    title: 'Error',
                    message: 'New passwords are not identical.'
                });
                return null;
            }
        } else {
            return oldPass;
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
                if (decrypted.sigBytes < 0) {
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

    var escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '`': '&#x60;'
    };

    function invert(map) {
        var ret = {};
        for (var i in map) {
            if (map.hasOwnProperty(i)) {
                ret[map[i]] = i;
            }
        }
        return ret;
    }

    var unescapeMap = invert(escapeMap);

    var createEscaper = function (map) {
        var escaper = function (match) {
            return map[match];
        };

        var keys = [];
        for (var i in map) {
            if (map.hasOwnProperty(i)) {
                keys.push(i);
            }
        }
        var source = '(?:' + keys.join('|') + ')';
        var testRegexp = RegExp(source);
        var replaceRegexp = RegExp(source, 'g');
        return function (string) {
            string = string == null ? '' : '' + string;
            return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
        };
    };

    var escape = createEscaper(escapeMap);
    var unescape = createEscaper(unescapeMap);

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
        var contentid = container[0].getAttribute('data-content');
        var type = container[0].getAttribute('data-type');
        var content = Content.getContent(contentid, type);
        var text = content.getText();

        var html, interHtml, oldTransformer;

        function postF(interHtml) {
            oldTransformer = content.getTransformer();

            html = oldTransformer(interHtml, content);
            html = html.replace(/{{THISCONTENT}}/g, "KMS.Content.getContent('" + contentid + "','" + content.type + "')");
            container.html(html);
            if (content.getTransformer() !== oldTransformer) {
                html = content.getTransformer(interHtml, content);
                html = html.replace(/{{THISCONTENT}}/g, "KMS.Content.getContent('" + contentid + "','" + content.type + "')");
                container.html(html);
            }

            container.find('.kms-location').each(function (i) {
                var dis = $(this);
                refreshContent(dis);
            });
        }

        try {
            interHtml = getParser(content.getType())(text, content, postF);
        } catch (e) {
            console.log(e);
            interHtml = "";
        }
        if (typeof interHtml === 'string') {
            postF(interHtml)
        }
    }


    function Content(id, text, transformer, type, creationTime, updateTime) {
        this.id = id;
        this.text = text.replace(/&lt;(\/textarea>)/gi, "<$1");
        this.transformer = transformer;
        this.type = type;
        this.creationTime = creationTime;
        this.updateTime = updateTime;
    }

    Content.defaultTransformer = function (text, content) {
        var prefix = '<div>';
        var suffix = '</div>';
        if (queryMap["edit"] === "true") {
            suffix += '<textarea style="z-index: 10000; display: none"></textarea>' +
                '<span class="glyphicon glyphicon-edit" style="z-index: 10000; padding: 2px;" title="Edit ' + content.getId() + '" onclick="KMS.editAction(this,{{THISCONTENT}})"></span>' +
                '<span class="glyphicon glyphicon-eye-open" style="z-index: 10000; padding: 2px; display: none;" title="Preview ' + content.getId() + '"  onclick="KMS.previewAction(this,{{THISCONTENT}})"></span>' +
                '<span class="glyphicon glyphicon-check" style="z-index: 10000; padding: 2px; display: none;" title="Save ' + content.getId() + '"  onclick="KMS.saveAction(this,{{THISCONTENT}})"></span>' +
                '<span class="glyphicon glyphicon-remove-circle" style="z-index: 10000; padding: 2px; display: none;" title="Cancel edit of ' + content.getId() + '"  onclick="KMS.cancelAction(this,{{THISCONTENT}})" ></span>';
        }
        return prefix + text + suffix;
    };

    Content.getContent = function (id, type) {
        var content = contents[id];
        if (!content) {
            type = type || ".html";
            contents[id] = content = new Content(id, "", Content.defaultTransformer, type, Date.now(), Date.now());
        }
        return content;
    };

    Content.deleteContent = function (id) {
        modified = true;
        delete contents[id];
    };

    Content.prototype.decrypt = function () {
        var txt = decrypt(this.text, this.type);
        if (txt === encString) {
            return false;
        } else {
            this.text = txt;
            return true;
        }
    };

    Content.prototype.getText = function () {
        if (isContentsEncrypted && isEnc(this.type)) {
            return encString;
        } else {
            return this.text;
        }
        //return decrypt(this.text, this.type);
    };

    Content.prototype.getType = function () {
        return this.type;
    };

    Content.prototype.setTextAndSave = function (text) {
        var ret = this.setText(text);
        if (ret) savePage();
        return ret;
    };

    Content.prototype.setText = function (text) {
        //text = encrypt(text, this.type);
        if (text !== null) {
            this.text = text;
            this.updateTime = Date.now();
            $("div[data-content='" + this.id + "']").each(function (i) {
                refreshContent($(this));
            });
            modified = true;
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
        var txt;
        if (isContentsEncrypted) {
            txt = this.text;
        } else {
            txt = encrypt(this.text, this.type);
        }
        if (txt === null) {
            throw "Encryption failed";
        }
        return '\x3Ctextarea id="' + this.getId() +
            '" class="kms-content" data-type="' + this.getType() +
            '" data-creation-time="' + this.getCreationTime() +
            '" data-update-time="' + this.getUpdateTime() +
            '">' +
            txt.replace(/<(\/textarea>)/gi, '&lt;$1').replace(/&/gi, '&amp;') +
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

    function saveerr(file, message) {
        BootstrapDialog.show({
            type: BootstrapDialog.TYPE_WARNING,
            title: 'Error',
            message: 'Cannot save ' + file + ". " + message
        });
        console.log("Error");
    }


    function sendRemoveRequest() {
        var oldPass = getPass('kms-password');
        var file = getCurrentFileName();
        var data = {oldFile: file, action: 'remove', password: oldPass};

        console.log("Deleting " + file + " ... ");
        $.ajax({
            url: module.URL,
            type: 'POST',
            data: data,
            success: function (result) {
                if (typeof result === 'string')
                    result = $.parseJSON(result);
                if (!result.success) {
                    console.log(result.message);
                    saveerr(file, result.message);
                } else {
                    modified = false;
                    console.log("Success");
                    console.log(result['data']);
                    BootstrapDialog.show({
                        message: 'Successfully deleted ' + data.oldFile
                    });
                }
            },
            error: function () {
                saveerr(file, "Ajax call failed " + JSON.stringify(data));
            }
        });

    }

    function savePageAux(file, str, oldFile) {
        var oldPass = getPass('kms-password');
        var newPass = getNewPass(oldPass);
        if (newPass !== null) {
            var data = {
                file: file,
                oldFile: oldFile,
                content: str,
                action: 'write',
                password: oldPass,
                newPassword: newPass
            };

            console.log("Saving " + file + " ... ");
            $.ajax({
                url: module.URL,
                type: 'POST',
                data: data,
                success: function (result) {
                    if (typeof result === 'string')
                        result = $.parseJSON(result);
                    if (!result.success) {
                        console.log(result.message);
                        saveerr(file, result.message);
                    } else {
                        modified = false;
                        console.log("Success");
                        console.log(result['data']);
                        loadScriptsOnce(["libkms/notify.js"], typeof $.notify !== "function", function () {
                            $.notify('Successfully saved ' + data.file, "success");
                        });
                        // BootstrapDialog.show({
                        //     message: 'Successfully saved ' + data.file
                        // });
                    }
                },
                error: function () {
                    saveerr(file, "Ajax call failed " + JSON.stringify(data));
                }
            });
        } else {
            BootstrapDialog.show({
                message: 'Password not entered'
            });
        }

    }

    function loadTemplate(promise) {
        function err() {
            BootstrapDialog.show({
                type: BootstrapDialog.TYPE_WARNING,
                title: 'Error',
                message: 'Failed to read ' + document.location.href
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
        if (file === '') {
            file = "index.html";
        }
        return file;
    }

    function savePage2() {
        var file = getCurrentFileName();
        var econtent;
        econtent = serializePage();
        savePageAux(file, econtent, file);
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
        var file = getCurrentFileName();
        savePageAux($('#kms-file').val(), ret, file);
    }


    function savePageAs2() {
        var econtent;
        econtent = serializePage();
        var file = getCurrentFileName();
        savePageAux($('#kms-file').val(), econtent, file);
    }


    function download() {
        loadTemplate(download2);
    }

    function savePage() {
        loadTemplate(savePage2);
    }

    function savePageAs() {
        loadTemplate(savePageAs2);
    }

    function newPage() {
        loadTemplate(newPage2);
    }

    function listContentsForDeletion() {
        var e = $('#kms-list');
        if (e.size() > 0) {
            e.remove();
        } else {
            var html = '<ul id="kms-list">';
            for (var divid in contents) {
                if (contents.hasOwnProperty(divid)) {
                    var content = contents[divid];
                    html = html + '<li><a href="#!trash=' + divid + content.type + '">[Remove] ' + escape(content.getText().substring(0, 40)) + '</a></li>\n';
                }
            }
            html = html + '</ul>';
            e.remove();
            $('body').append($(html));
        }
    }

    function refreshPage() {
        decryptContents();
        refreshContent($(KMSMAIN));
        $(window).trigger('hashchange');
    }

    function removePage() {
        BootstrapDialog.show({
            type: BootstrapDialog.TYPE_WARNING,
            title: 'Delete?',
            message: 'Delete current file?',
            buttons: [{
                label: 'Delete',
                action: function (dialog) {
                    dialog.close();
                    sendRemoveRequest();
                }
            }, {
                label: 'Cancel',
                action: function (dialog) {
                    dialog.close();
                }
            }]
        });
    }

    module.removePage = removePage;
    module.savePage = savePage;
    module.savePageAs = savePageAs;
    module.newPage = newPage;
    module.download = download;
    module.listContents = listContentsForDeletion;
    module.refreshPage = refreshPage;

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
            var pipeindex = hash.indexOf("|");
            if (pipeindex < 0) {
                pipeindex = hash.length;
            }
            hash = hash.substring(2, pipeindex);
            var anchorMap = {};
            var kvs = hash.split('&');
            for (var i = 0; i < kvs.length; i++) {
                var kv = kvs[i].split('=');
                anchorMap[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
            }

            for (k in anchorMap) {
                if (anchorMap.hasOwnProperty(k)) {
                    //if (currentAnchorMap[k] !== anchorMap[k]) {
                    var idtype = anchorMap[k];
                    var id = idtype.substring(0, idtype.indexOf("."));
                    var type = idtype.substring(idtype.indexOf("."));
                    if (k === 'trash') {
                        Content.deleteContent(id);
                    } else {
                        var container = $('#' + k);
                        container[0].setAttribute('data-content', id);
                        container[0].setAttribute('data-type', type);
                        refreshContent(container);
                    }
                    //}
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
                }, get oldFile() {
                    return getCurrentFileName();
                }
            },
            fileName: 'uploaded',
            onInit: function () {
                console.log('Plugin successfully initialized');
            },
            onUploadSuccess: function (id, data) {
                if (typeof data === 'string')
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
                        message: 'Upload failed. ' + data.message
                    });
                }
            },
            onComplete: function () {
                console.log('We reach the end of the upload Queue!');
            }
        });
    }

    /********************************************************************/

    var codeMirrorSrcUrls = ["libkms/codemirror.min.js",
        "libkms/css.min.js",
        "libkms/javascript.min.js",
        "libkms/xml.min.js",
        "libkms/htmlembedded.min.js",
        "libkms/clike.min.js",
        "libkms/php.min.js",
        "libkms/markdown.min.js",
        "libkms/matchbrackets.min.js",
        "libkms/fullscreen.min.js"
    ];

    function editAction(e, content) {
        loadScriptsOnce(codeMirrorSrcUrls, 'CodeMirror', function () {
            var dec = content.getText();
            if (dec !== encString) {
                var i = 2;
                var siblings = $(e).siblings();
                var $divhtml = $(siblings[0]);
                var $divtext = $(siblings[1]);
                var $buttonEdit = $(e);
                var $buttonSave = $(siblings[i]);
                var $buttonHardSave = $(siblings[i + 1]);
                var $buttonCancel = $(siblings[i + 2]);


                $buttonSave.show();
                $buttonHardSave.show();
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
                content.editor = editor;
                editor.setValue(dec);
            } else {
                BootstrapDialog.show({
                    type: BootstrapDialog.TYPE_WARNING,
                    title: 'Warning',
                    message: 'Cannot edit encrypted data before decryption.'
                });
            }
        });
    }


    function previewAction(e, content) {
        loadScriptsOnce(codeMirrorSrcUrls, 'CodeMirror', function () {
            var i = 3;
            var siblings = $(e).siblings();
            var $divhtml = $(siblings[0]);
            var $divtext = $(siblings[1]);
            var $buttonEdit = $(siblings[i]);
            var $buttonSave = $(e);
            var $buttonHardSave = $(siblings[i + 1]);
            var $buttonCancel = $(siblings[i + 2]);
            var editor = content.editor;

            if (content.setText(editor.getValue())) {
                $buttonEdit.show();
                $buttonSave.hide();
                $buttonHardSave.hide();
                $buttonCancel.hide();
                $divhtml.show();
                editor.toTextArea();
                $divtext.hide();
                content.editor = undefined;
            }
        });
    }

    function saveAction(e, content) {
        loadScriptsOnce(codeMirrorSrcUrls, 'CodeMirror', function () {
            var i = 3;
            var siblings = $(e).siblings();
            var $divhtml = $(siblings[0]);
            var $divtext = $(siblings[1]);
            var $buttonEdit = $(siblings[i]);
            var $buttonSave = $(siblings[i + 1]);
            var $buttonHardSave = $(e);
            var $buttonCancel = $(siblings[i + 2]);
            var editor = content.editor;

            if (content.setTextAndSave(editor.getValue())) {
                $buttonEdit.show();
                $buttonSave.hide();
                $buttonHardSave.hide();
                $buttonCancel.hide();
                $divhtml.show();
//                savePage();
                editor.toTextArea();
                $divtext.hide();
                content.editor = undefined;
            }
        });
    }

    function cancelAction(e, content) {
        loadScriptsOnce(codeMirrorSrcUrls, 'CodeMirror', function () {
            var siblings = $(e).siblings();
            var i = 3;
            var $divhtml = $(siblings[0]);
            var $divtext = $(siblings[1]);
            var $buttonEdit = $(siblings[i]);
            var $buttonSave = $(siblings[i + 1]);
            var $buttonHardSave = $(siblings[i + 2]);
            var $buttonCancel = $(e);
            var editor = content.editor;

            var text = editor.getValue();
            var oldText = content.getText();
            if (text === oldText) {
                $buttonEdit.show();
                $buttonSave.hide();
                $buttonHardSave.hide();
                $buttonCancel.hide();
                $divhtml.show();
                editor.toTextArea();
                $divtext.hide();
                content.editor = undefined;
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
                            $buttonHardSave.hide();
                            $buttonCancel.hide();
                            $divhtml.show();
                            editor.toTextArea();
                            $divtext.hide();
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
        });
    }

    module.editAction = editAction;
    module.previewAction = previewAction;
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

    function decryptContents() {
        if (isContentsEncrypted) {
            for (var divid in contents) {
                if (contents.hasOwnProperty(divid)) {
                    var content = contents[divid];
                    if (!content.decrypt()) {
                        return false;
                    }
                }
            }
        }
        isContentsEncrypted = false;
        return true;
    }

    function reloadToAvoidCache() {
        parseQuery();
        var loc = window.location;
        var n = (new Date()).getTime();
        if (queryMap.hasOwnProperty("rnd")) {
            if ((+queryMap["rnd"]) + 60000 <= n) {
                window.location.href = loc.origin + loc.pathname + encodeQuery("rnd", n) + loc.hash;
            }
        } else {
            window.location.href = loc.origin + loc.pathname + encodeQuery("rnd", n) + loc.hash;
        }
//         if (typeof search !== 'string' || search.length <= 0) {
//             window.location.href = loc.origin + loc.pathname + searchPref + n + loc.hash;
//         } else if ((+search.substring(searchPref.length)) + 60000 <= n) {
// //            console.log((search.substring(searchPref.length)|0) + 60000);
//              window.location.href = loc.origin+loc.pathname+searchPref+n+loc.hash;
//         }
    }

    /********************************************************************/

    $(document).ready(function () {
            reloadToAvoidCache();
            console.log("Populating page");
            //var hash = window.location.hash;
            //if (hash !== '') {
            //    anchorLoadChange();
            //}
            if (queryMap["edit"] === "true") {
                $('body').append('<div class="container" style="z-index: 10000;">' +
                    '	<a data-toggle="collapse" href="#kms-collapse">        ' +
                    '		 <span class="glyphicon glyphicon-cog"></span>    ' +
                    '	</a>    ' +
                    '	<div class="row">        ' +
                    '		<div id="kms-collapse" class="collapse">            ' +
                    '           <legend>KMS Control Center</legend>' +
                    '			<div class="form-horizontal">' +
                    '	            <fieldset>' +
                    '	                <div class="form-group">' +
                    '						<label class="col-md-4 control-label" for="kms-key1">Encryption/Decryption Key</label>' +
                    '						<div class="col-md-6">                ' +
                    '							<input type="password" id="kms-key1" class="pull-right form-control input-sm" style="padding: 1em;" placeholder="Key for encryption/decryption ...">            ' +
                    '						</div>' +
                    '					</div>' +
                    '	                <div class="form-group">' +
                    '						<label class="col-md-4 control-label" for="kms-key2">Re-enter Encryption Key</label>' +
                    '						<div class="col-md-6">                ' +
                    '							<input type="password" id="kms-key2" class="pull-right form-control input-sm" style="padding: 1em;" placeholder="Re-enter Key for encryption ...">            ' +
                    '						</div>' +
                    '					</div>' +
                    '	                <div class="form-group">' +
                    '						<label class="col-md-4 control-label" for="kms-password">Password for Remote Server</label>' +
                    '						<div class="col-md-6">                ' +
                    '							<input type="password" id="kms-password" class="pull-right form-control input-sm" style="padding: 1em;" placeholder="Password for Remote Server ...">            ' +
                    '						</div>' +
                    '					</div>' +
                    '	                <div class="form-group">' +
                    '						<label class="col-md-4 control-label" for="kms-password-new1">New Password for Remote Server</label>' +
                    '						<div class="col-md-6">                ' +
                    '							<input type="password" id="kms-password-new1" class="pull-right form-control input-sm" style="padding: 1em;" placeholder="New Password for Remote Server ...">            ' +
                    '						</div>' +
                    '					</div>' +
                    '	                <div class="form-group">' +
                    '						<label class="col-md-4 control-label" for="kms-password-new2">Re-enter New Password for Remote Server</label>' +
                    '						<div class="col-md-6">                ' +
                    '							<input type="password" id="kms-password-new2" class="pull-right form-control input-sm" style="padding: 1em;" placeholder="Re-enter New Password for Remote Server ...">            ' +
                    '						</div>' +
                    '					</div>' +
                    '	                <div class="form-group">' +
                    '						<label class="col-md-4 control-label" for="kms-file">Remote File Name</label>' +
                    '						<div class="col-md-6">                ' +
                    '							<input type="text" id="kms-file" class="pull-right form-control input-sm" style="padding: 1em;" placeholder="Remote File Name ...">            ' +
                    '						</div>' +
                    '					</div>' +
                    '	                <div class="form-group">' +
                    '						<label class="col-md-4 control-label" for="kms-drop-area-div">File Upload Area</label>' +
                    '						<div id="kms-drop-area-div" class="col-md-6" style="border-style: dashed; height: 3em; padding: 0.6em;">' +
                    '							Drag and Drop Files Here<br>            ' +
                    '						</div>            ' +
                    '					</div>' +
                    '					<div class="form-group">' +
                    '						<label class="col-md-4 control-label"></label>' +
                    '	                    <div class="col-md-8">' +
                    '							<button onclick="KMS.refreshPage()" class="btn btn-primary" title="Refresh page">Refresh</button>                ' +
                    '							<button onclick="KMS.savePage()" class="btn btn-primary" title="Save">Save</button>                ' +
                    '							<button onclick="KMS.download()" class="btn btn-primary" title="Download">Download</button>                ' +
                    '							<button onclick="KMS.removePage()" class="btn btn-primary" title="Remove page">Delete</button>                ' +
                    '							<button onclick="KMS.newPage()" class="btn btn-primary" title="Create new using file name">New</button>                ' +
                    '							<button onclick="KMS.savePageAs()" class="btn btn-primary" title="Save as file name">Save as</button>                ' +
                    '							<button onclick="KMS.listContents()" class="btn btn-primary" title="List contents for removal.  Must save after removal.">List Contents</button>            ' +
                    '                    	</div>' +
                    '	                </div>' +
                    '				</fieldset>' +
                    '			</div>' +
                    '		</div>    ' +
                    '	</div>' +
                    '</div>');
                initUploader();
            } else {
                $('body').append('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="' + encodeQuery("edit", "true") + '">...</a>');
            }
            collectContents();
            getPass('kms-key1');
            getPass('kms-key2');
            getPass('kms-password');
            decryptContents();
            refreshContent($(KMSMAIN));

            $(window).bind('hashchange', anchorLoadChange).trigger('hashchange');
            $(window).bind('beforeunload', function (e) {
                if (modified) {
                    return "Page modified.  Do you want to leave without saving the page?";
                }
            });

        }
    );


    /********************************************************************/
    /***************************  API  **********************************/
    /********************************************************************/
    module.Content = Content;
    module.setPlugin = setPlugin;
    module.getPlugin = getPlugin;
    module.URL = "https://apps.eecs.berkeley.edu/~ksen/readwrite2.php";
    module.loadScriptsOnce = loadScriptsOnce;
    module.escape = escape;
    module.unescape = unescape;

}(KMS));
