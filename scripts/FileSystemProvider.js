const vscode = require('vscode');
const path = require('./path');

module.exports = class FileSystemProvider {
    constructor() {
    }
    watch() {
        // ignore, fires for all changes...
        return new vscode.Disposable(() => {});
    }
    readDirectory() {
        return this._readDirectory();
    }
    async _readDirectory() {
        const result = [];

        var allFiles = await vscode.workspace.findFiles("**/*");
        allFiles.sort();
        for(let {fsPath: child} of allFiles) {
            result.push({
                name: `${child}`,
                type:vscode.FileType.File
            });
        }

        return Promise.resolve(result);
    }
    // tree data provider
    async getChildren() {
        const children = await this.readDirectory();
        children.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
        return children.map(({name, type}) => ({ uri: vscode.Uri.file(name), type }));
    }
    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.uri, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        treeItem.description = `${path.dirname(element.uri.fsPath)}`;

        var _a;
        const workspaceFolder = ((_a = vscode.workspace.workspaceFolders) !== null && _a !== void 0 ? _a : []).filter(folder => folder.uri.scheme === 'file')[0];
        if (workspaceFolder) {
            treeItem.description = treeItem.description.replace(workspaceFolder.uri.fsPath, "");
        }

        if (element.type === vscode.FileType.File) {
            treeItem.command = { command: 'vscode.open', title: "Open File", arguments: [element.uri], };
            treeItem.contextValue = 'file';
        }
        return treeItem;
    }
}