var fso = new ActiveXObject('Scripting.FileSystemObject');
var text = fso.OpenTextFile('js/config.js', 1).ReadAll();
try {
    var fn = new Function(text);
    WScript.Echo('OK');
} catch (e) {
    WScript.Echo('ERROR: ' + e.message + ' line ' + e.lineNumber);
}
