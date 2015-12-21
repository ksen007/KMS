

# Main files:

 * index.html - This is the starting template.  Default password for this file is *password*
 * kms4.js - The main KMS library.  It creates the KMS object.
 * install.sh - Run this to download and install all third-party libraries used by KMS.
 * readwrite2.php - PHP file for the server side to store the modified .html file on the server side if the provided
 password matches the encoded password in the existing .html file on the server.


# KMS Tag:

    <div id="id-of-this-location" class="kms-location" data-content="id-of-content" data-type="(.html|.md|.wiki|.txt|.js|.css|.php)[.enc]"></div>

```.enc``` denotes that the content is encrypted.

# KMS URL:

Once can show contents with id, say "x", and type, say ".typ", at kms-location (i.e. a div tag with class *kms-location*)
with id, say "y", by specifying the key-value pair y=x.typ in the URL after #!.  Multiple key-value pairs are separated
using '&'.

# API provided by KMS:

 * **document.title** - should be set to change the title of the page.

 * **KMS.getPlugin(type)** - returns an object with properties **mode** set to editor type and **converter** set to a converter
function with signature **function(text, content)**, where **text** is the text to be converted and **content** is an
object of type **Content** described below.  The converter function returns the converted string.

 * **KMS.setPlugin(type, mode, converter)** -- sets the editor **mode** and **converter** function for the **type**.  Pre-defined
modes are **'markdown', 'javascript', 'css', 'text/html', 'application/x-httpd-php', undefined**.  The signature of a
converter function is defined above.

 * **KMS.URL** - The URL of the readwrite2.php file.

 * **Content** - Content class describes a content in KMS.  It has the following methods:
    * **getText()** - returns the text associated with the content.
    * **setText(text)** - sets the text of the content to **text**.
    * **getCreationTime()** - returns the creation time of this content as a number.
    * **getUpdateTime()** - returns the last update time of this content as a number.
    * **getId()** - returns the id of this content as a string.  The id can be used in a KMS URL as the value part of a key-value pair.
    * **getType()** - returns the type of the content as a string.

# KMS Macro:

**{{THISCONTENT}}** expands to a JavaScript method call that returns the Content object denoting the content containing the macro.

