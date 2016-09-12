var KMS = {};
(function (module) {

    /********************************************************************/

    function loadScriptsOnce(scriptList, globalVar, cb) {
        if (typeof window[globalVar] === 'undefined') {

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

    /*************************************************************************/



}());
