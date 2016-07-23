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
                        ls: K.getActionRoute(Docker, "ls")
                    }
                });
        });
    }

    @DocAction(`Starts a container`)
    @K.ActionMiddleware(App.authorize)
    start(context: Context): void {
        let id = context.request.query.id;
        if (id == undefined) {
            context.response.status(404).send("invalid id");
            return;
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

    @DocAction(`Lists the content of a directory from a container`)
    @K.ActionMiddleware(App.authorize)
    ls(context: Context) {
        let id = context.request.query.id;
        let path = context.request.query.path;

        if (id == undefined || path == undefined) {
            context.response.status(404).send("invalid id or path");
            return;
        }

        let container = this.dockerAPI.getContainer(id);

        container.exec({
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            Cmd: ["ls", "-lap", path]
        }, (err, exec) => {
            if (err) {
                this.handleError(context, err);
                return;
            }

            exec.start((err, stream) => {
                if (err) {
                    this.handleError(context, err);
                    return;
                }

                this.readStream(stream, content => {
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
                            let newPath = path + entryName;

                            if (entryName.endsWith("/")) {
                                action = K.getActionRoute(Docker, "ls");
                            } else {
                                action = K.getActionRoute(Docker, "getArchive");
                            }

                            let link = `${action}?id=${id}&path=${path + entryName}`;

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
        });

    }

    @DocAction(`Gets the content of a file from a container`)
    @K.ActionMiddleware(App.authorize)
    getArchive(context: Context) {
        let id: string = context.request.query.id;
        let path: string = context.request.query.path;

        if (id == undefined || path == undefined) {
            context.response.status(404).send("invalid id or path");
            return;
        }

        let container = this.dockerAPI.getContainer(id);

        container.getArchive({
            path: path
        }, (err, stream) => {
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
                FS.mkdirSync(extractDir);

                let extractStream = Tar.Extract(extractDir)
                    .on("error", err => {
                        this.handleError(context, err);
                    })
                    .on("end", () => {
                        let extractedFilePath = Path.join(extractDir, fileName);
                        let readStream = FS.createReadStream(extractedFilePath);

                        readStream.on("error", err => {
                            this.handleError(context, err);
                        });

                        readStream.on("end", () => {
                            FSExtra.remove(extractDir, err => {
                                if (err) {
                                    console.log(`Couldn't delete ${extractedFilePath}. ${err}`);
                                }
                            });
                        });

                        context.response.setHeader("Content-Type", "application/octet-stream");
                        context.response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
                        readStream.pipe(context.response);
                    });

                stream.pipe(extractStream);
            }

        });
    }

    @DocAction(`Shows the logs for the container with the id sent in the querystring`)
    @K.ActionMiddleware(App.authorize)
    logs(context: Context): void {

        let id = context.request.query.id;
        if (id == undefined) {
            context.response.status(404).send("invalid id");
            return;
        }

        let container = this.dockerAPI.getContainer(id);

        container.logs({
            timestamps: true,
            stdout: true,
            stderr: true,
            tty: false
        }, (err, stream) => {
            if (err) {
                this.handleError(context, err);
                return;
            }
            this.readStream(stream, data => {
                let parts = Parser(data);

                let html = "";
                for (let p of parts) {
                    html += p.text;
                }
                context.response.send("<html><body><pre>" + html + "</pre></body></html>");
            });
        });
    }

    private readStream(stream: any, callback: (content: string) => void) {
        var data = "";

        var finalStream = new Stream.PassThrough();
        finalStream.on("data", chunk => {
            data += chunk;
        });

        stream.on("end", () => {
            stream.destroy();
            callback(data);
        });

        this.dockerAPI.modem.demuxStream(stream, finalStream, finalStream);
    }
}