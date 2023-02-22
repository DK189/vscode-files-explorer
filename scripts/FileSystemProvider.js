const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

//#region Utilities
function handleResult(resolve, reject, error, result) {
    if (error) {
        reject(massageError(error));
    }
    else {
        resolve(result);
    }
}
function massageError(error) {
    if (error.code === 'ENOENT') {
        return vscode.FileSystemError.FileNotFound();
    }
    if (error.code === 'EISDIR') {
        return vscode.FileSystemError.FileIsADirectory();
    }
    if (error.code === 'EEXIST') {
        return vscode.FileSystemError.FileExists();
    }
    if (error.code === 'EPERM' || error.code === 'EACCESS') {
        return vscode.FileSystemError.NoPermissions();
    }
    return error;
}
// eslint-disable-next-line no-unused-vars
function checkCancellation(token) {
    if (token.isCancellationRequested) {
        throw new Error('Operation cancelled');
    }
}
function normalizeNFC(items) {
    if (process.platform !== 'darwin') {
        return items;
    }
    if (Array.isArray(items)) {
        return items.map(item => item.normalize('NFC'));
    }
    return items.normalize('NFC');
}
// eslint-disable-next-line no-unused-vars
function readdir(path) {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (error, children) => handleResult(resolve, reject, error, normalizeNFC(children)));
    });
}
function stat(path) {
    return new Promise((resolve, reject) => {
        fs.stat(path, (error, stat) => handleResult(resolve, reject, error, stat));
    });
}
function readfile(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (error, buffer) => handleResult(resolve, reject, error, buffer));
    });
}
function writefile(path, content) {
    return new Promise((resolve, reject) => {
        fs.writeFile(path, content, error => handleResult(resolve, reject, error, void 0));
    });
}
function exists(path) {
    return new Promise((resolve, reject) => {
        fs.exists(path, exists => handleResult(resolve, reject, null, exists));
    });
}
function rmrf(path) {
    return new Promise((resolve, reject) => {
        rimraf(path, error => handleResult(resolve, reject, error, void 0));
    });
}
function mkdir(path) {
    return new Promise((resolve, reject) => {
        mkdirp(path, error => handleResult(resolve, reject, error, void 0));
    });
}
function rename(oldPath, newPath) {
    return new Promise((resolve, reject) => {
        fs.rename(oldPath, newPath, error => handleResult(resolve, reject, error, void 0));
    });
}
function unlink(path) {
    return new Promise((resolve, reject) => {
        fs.unlink(path, error => handleResult(resolve, reject, error, void 0));
    });
}
class FileStat {
    constructor(fsStat) {
        this.fsStat = fsStat;
    }
    get type() {
        return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown;
    }
    get isFile() {
        return this.fsStat.isFile();
    }
    get isDirectory() {
        return this.fsStat.isDirectory();
    }
    get isSymbolicLink() {
        return this.fsStat.isSymbolicLink();
    }
    get size() {
        return this.fsStat.size;
    }
    get ctime() {
        return this.fsStat.ctime.getTime();
    }
    get mtime() {
        return this.fsStat.mtime.getTime();
    }
}
//#endregion
module.exports = class FileSystemProvider {
    constructor() {
        this._onDidChangeFile = new vscode.EventEmitter();
    }
    get onDidChangeFile() {
        return this._onDidChangeFile.event;
    }
    watch(uri, options) {
        const watcher = fs.watch(uri.fsPath, { recursive: options.recursive }, async (event, filename) => {
            const filepath = path.join(uri.fsPath, normalizeNFC(filename.toString()));
            // TODO support excludes (using minimatch library?)
            this._onDidChangeFile.fire([{
                    type: event === 'change' ? vscode.FileChangeType.Changed : await exists(filepath) ? vscode.FileChangeType.Created : vscode.FileChangeType.Deleted,
                    uri: uri.with({ path: filepath })
                }]);
        });
        return { dispose: () => watcher.close() };
    }
    stat(uri) {
        return this._stat(uri.fsPath);
    }
    async _stat(path) {
        return new FileStat(await stat(path));
    }
    readDirectory(uri) {
        return this._readDirectory(uri);
    }
    // eslint-disable-next-line no-unused-vars
    async _readDirectory(uri) {
        const result = [];

        var allFiles = await vscode.workspace.findFiles("**/*");
        allFiles.sort();
        for(let {fsPath: child} of allFiles) {
            const stat = await this._stat(child);
            result.push([child, stat.type]);
        }

        return Promise.resolve(result);
    }
    createDirectory(uri) {
        return mkdir(uri.fsPath);
    }
    readFile(uri) {
        return readfile(uri.fsPath);
    }
    writeFile(uri, content, options) {
        return this._writeFile(uri, content, options);
    }
    async _writeFile(uri, content, options) {
        const _exists = await exists(uri.fsPath);
        if (!_exists) {
            if (!options.create) {
                throw vscode.FileSystemError.FileNotFound();
            }
            await mkdir(path.dirname(uri.fsPath));
        }
        else {
            if (!options.overwrite) {
                throw vscode.FileSystemError.FileExists();
            }
        }
        return writefile(uri.fsPath, content);
    }
    delete(uri, options) {
        if (options.recursive) {
            return rmrf(uri.fsPath);
        }
        return unlink(uri.fsPath);
    }
    rename(oldUri, newUri, options) {
        return this._rename(oldUri, newUri, options);
    }
    async _rename(oldUri, newUri, options) {
        const _exists = await exists(newUri.fsPath);
        if (_exists) {
            if (!options.overwrite) {
                throw vscode.FileSystemError.FileExists();
            }
            else {
                await rmrf(newUri.fsPath);
            }
        }
        const parentExists = await exists(path.dirname(newUri.fsPath));
        if (!parentExists) {
            await mkdir(path.dirname(newUri.fsPath));
        }
        return rename(oldUri.fsPath, newUri.fsPath);
    }
    // tree data provider
    async getChildren(element) {
        var _a;
        if (element) {
            const children = await this.readDirectory(element.uri);
            return children.map(([name, type]) => ({ uri: vscode.Uri.file(name), type }));
        }
        const workspaceFolder = ((_a = vscode.workspace.workspaceFolders) !== null && _a !== void 0 ? _a : []).filter(folder => folder.uri.scheme === 'file')[0];
        if (workspaceFolder) {
            const children = await this.readDirectory(workspaceFolder.uri);
            // children.sort((a, b) => {
            //     if (a[1] === b[1]) {
            //         return a[0].localeCompare(b[0]);
            //     }
            //     return a[1] === vscode.FileType.Directory ? -1 : 1;
            // });
            return children.map(([name, type]) => ({ uri: vscode.Uri.file(name), type }));
        }
        return [];
    }
    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.uri, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        treeItem.description = path.dirname(element.uri.fsPath);

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