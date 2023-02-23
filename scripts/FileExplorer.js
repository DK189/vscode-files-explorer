const vscode = require('vscode');
// const fs = require('fs');
const path = require("path");

const FileSystemProvider = require("./FileSystemProvider");

function registerCommand(vscode, context, command, handle) {
    let disposable = vscode.commands.registerCommand(command, handle);
    context.subscriptions.push(disposable);
}

function FileExplorer() {

}

FileExplorer.prototype.expandAllFolder = async function expandAllFolder() {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Expand all folder",
        cancellable: true,
    }, async (progress, token) => {
        progress.report({ increment: 0 });
        var allFiles = await vscode.workspace.findFiles("**/*");
        allFiles.sort();
        
        let optimizeOpenEntries = allFiles.reduce((a, file) => {
            let dir = path.dirname(file.fsPath);
            if (!a[dir]) a[dir] = file;
            return a;
        },{});
        
        let letOpenEntries = Object.values(optimizeOpenEntries);
        letOpenEntries = letOpenEntries.sort();
        let letOpenEntries_length = letOpenEntries.length;
        
        let extMsg = letOpenEntries_length < 15 ? {} : {message: "It's large workspace, please wait..."};

        progress.report({ increment: 15, ...extMsg });
        
        for (let {file} of letOpenEntries.map((file, index) => ({file, index}))) {
            
            await vscode.commands.executeCommand('revealInExplorer', file);

            progress.report({ increment: ((85/letOpenEntries_length)), ...extMsg });

            if (token.isCancellationRequested) {
                break;
            }
        }

        // progress.report({ increment: 100 });
    })
};

FileExplorer.prototype.RegisterCommands = function RegisterCommands(/** @type {vscode.ExtensionContext} */ context) {
    vscode.window.registerTreeDataProvider("vscode-files-explorer.views.files-explorer-list", new FileSystemProvider());

    registerCommand(vscode, context, `vscode-files-explorer.commands.expand-all-folder`, this.expandAllFolder);
};


module.exports = FileExplorer;