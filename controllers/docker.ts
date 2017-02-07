import { Controller, DocController, DocAction, Get, Post, Context } from "kwyjibo";
import * as K from "kwyjibo";
import App from "../app";
import * as Stream from "stream";
import * as OS from "os";
import * as Tar from "tar";
import * as FS from "fs";
import * as FSExtra from "fs-extra";
import * as Path from "path";
import * as UUID from "node-uuid";
import * as Events from "events";

let Dockerode = require("dockerode");
let Parser = require("ansi-style-parser");

@Controller("/docker")
@DocController("Docker operations controller.")
class Docker {
    private dockerAPI = undefined;

    constructor() {
        this.dockerAPI = new Dockerode({ socketPath: "/var/run/docker.sock" });
    }

    private handleError(context: Context, error: any): void {
        context.response.status(500).send(error);
    }

    @Get("/")
    @DocAction("Redirects to the containers action")
    index(context: Context) {
        context.response.redirect(K.getActionRoute(Docker, "containers"));
    }

    @K.ActionMiddleware(App.authorize)
    @DocAction(`Lists existing containers`)
    containers(context: Context): void {
        this.dockerAPI.listContainers({ all: true }, (err, containers) => {
            if (err) {
                this.handleError(context, err);
                return;
            }

            context.response.render("containersList",
                {
                    model: containers,
                    paths: {
                        logs: K.getActionRoute(Docker, "logs"),
                        start: K.getActionRoute(Docker, "start"),
                        stop: K.getActionRoute(Docker, "stop"),
                        ls: K.getActionRoute(Docker, "ls")
                    }
                });
        });
    }

    @DocAction(`Starts a container`)
    @K.ActionMiddleware(App.authorize)
    start(context: Context, @K.FromQuery("id") id: String): void {
        if (id == undefined) {
            throw new K.NotFound("invalid id");
        }

        let container = this.dockerAPI.getContainer(id);

        container.start((err, stream) => {
            if (err) {
                this.handleError(context, err);
                return;
            }

            context.response.redirect(K.getActionRoute(Docker, "containers"));
        });
    }

    @DocAction(`Stops a container`)
    @K.ActionMiddleware(App.authorize)
    stop(context: Context, @K.FromQuery("id") id: String): void {
        if (id == undefined) {
            throw new K.NotFound("invalid id");
        }

        let container = this.dockerAPI.getContainer(id);

        container.stop((err, stream) => {
            if (err) {
                this.handleError(context, err);
                return;
            }

            context.response.redirect(K.getActionRoute(Docker, "containers"));
        });
    }

    @DocAction(`Lists the content of a directory from a container`)
    @K.ActionMiddleware(App.authorize)
    ls(context: Context, @K.FromQuery("id") id: String, @K.FromQuery("path") path: String) {
        if (id == undefined || path == undefined) {
            throw new K.NotFound("invalid path or id");
        }

        let container = this.dockerAPI.getContainer(id);

        container.exec({
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            Cmd: ["ls", "-lahp", path]
        }, (err, exec) => {
            if (err) {
                this.handleError(context, err);
                return;
            }

            exec.start(async (err, stream) => {
                if (err) {
                    this.handleError(context, err);
                    return;
                }

                let content: String;
                try {
                    content = await this.readStream(stream);
                } catch (err) {
                    this.handleError(context, err);
                    return;
                }

                let model = {
                    path: path,
                    id: id,
                    entries: [],
                    downloadDirPath: `${K.getActionRoute(Docker, "getArchive")}?id=${id}&path=${path}`
                };

                let lines = content.split(OS.EOL);

                for (let line of lines) {
                    if (!line.startsWith("total")) {
                        let lastSpace = line.lastIndexOf(" ");
                        let info = line.substring(0, lastSpace);
                        let entryName = line.substring(lastSpace + 1);
                        let action = "";

                        let newPath = path;
                        if (entryName === "../"){
                            let withoutLastSlash = newPath.substr(0, newPath.length - 1);
                            let lastSlash = withoutLastSlash.lastIndexOf("/");
                            newPath = newPath.substr(0, lastSlash + 1);
                        } else if (entryName !== "./") {
                            newPath += entryName;
                        }

                        if (newPath === "") {
                            newPath = "/";
                        }

                        if (entryName.endsWith("/")) {
                            action = K.getActionRoute(Docker, "ls");
                        } else {
                            action = K.getActionRoute(Docker, "getArchive");
                        }

                        let link = `${action}?id=${id}&path=${newPath}`;

                        let entry = {
                            info: info,
                            name: entryName,
                            link: link
                        };

                        model.entries.push(entry);
                    }
                }

                context.response.render("fsList", model);
            });
        });
    }

    @DocAction(`Gets the content of a file from a container`)
    @K.ActionMiddleware(App.authorize)
    getArchive(context: Context, @K.FromQuery("id") id: String, @K.FromQuery("path") path: String) {
        if (id == undefined || path == undefined) {
            throw new K.NotFound("invalid path or id");
        }

        let container = this.dockerAPI.getContainer(id);

        container.getArchive({
            path: path
        }, async (err, stream) => {
            if (err) {
                this.handleError(context, err);
                return;
            }

            if (path.endsWith("/")) { // directory

                let dirName = path.split("/").join("__");
                context.response.setHeader("Content-Type", "application/octet-stream");
                context.response.setHeader("Content-Disposition", `attachment; filename="${dirName}.tar"`);
                stream.pipe(context.response);
            } else { // file
                let parts = path.split("/");

                let fileName = parts[parts.length - 1];

                let tempFilePath = OS.tmpdir();
                let random = UUID.v4();
                let extractDir = Path.join(tempFilePath, random);
                try {

                    FS.mkdirSync(extractDir);
                    let extractedFilePath = Path.join(extractDir, fileName);
                    let extractStream = Tar.Extract(extractDir);

                    stream.pipe(extractStream);

                    let extractStreamPromise = await this.emitterToPromise(extractStream);

                    let readStream = FS.createReadStream(extractedFilePath);
                    
                    let contentType = "application/octet-stream";
                    
                    // TODO: Use node-mime package to do this.
                    if (fileName.endsWith(".txt") || fileName.endsWith(".logs")) {
                        contentType = "text/plain";
                    }

                    context.response.setHeader("Content-Type", );
                    context.response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

                    readStream.pipe(context.response);

                    let readStreamPromise = await this.emitterToPromise(readStream);
                    FSExtra.removeSync(extractDir);

                } catch (err) {
                    this.handleError(context, err);
                    return;
                }
            }
        });
    }

    @DocAction(`Shows the logs for the container with the id sent in the querystring`)
    @K.ActionMiddleware(App.authorize)
    logs(context: Context, @K.FromQuery("id") id: String): void {
        if (id == undefined) {
            throw new K.NotFound("invalid id");
        }

        let container = this.dockerAPI.getContainer(id);

        container.logs({
            timestamps: true,
            stdout: true,
            stderr: true,
            tty: false
        }, async (err, stream) => {
            if (err) {
                this.handleError(context, err);
                return;
            }

            let data: String;
            try {
                data = await this.readStream(stream);
            } catch (err) {
                this.handleError(context, err);
                return;
            }

            let parts = Parser(data);

            let html = "";
            for (let p of parts) {
                html += p.text;
            }
            context.response.send("<html><body><pre>" + html + "</pre></body></html>");
        });
    }

    private readStream(stream: any): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            var data = "";

            var finalStream = new Stream.PassThrough();
            finalStream.on("data", chunk => {
                data += chunk;
            });

            stream.on("end", () => {
                stream.destroy();
                resolve(data);
            });

            stream.on("error", err => {
                reject(err);
            })

            this.dockerAPI.modem.demuxStream(stream, finalStream, finalStream);
        });
    }

    private emitterToPromise<T extends Events.EventEmitter>(emitter: T, resolveEvent?: string): Promise<T> {
        if (resolveEvent == undefined) {
            resolveEvent = "end";
        }

        return new Promise<T>((resolve, reject) => {
            emitter.on(resolveEvent, () => {
                resolve(emitter);
            });

            emitter.on("error", err => {
                reject(err);
            });
        });
    }
}
