// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const FileExplorer = require('./FileExplorer');

const fileExplorer = new FileExplorer();


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // console.log("process.platform", process.platform);
    // window.vscode = vscode;
    // vscode.window.showInformationMessage('vscode-files-explorer activate. ');

    fileExplorer.RegisterCommands(context);
    
}

// This method is called when your extension is deactivated
function deactivate() {
    vscode.window.showInformationMessage('Bye bye!');
}

module.exports = {
    activate,
    deactivate
}
