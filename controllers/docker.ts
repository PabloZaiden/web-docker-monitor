import {Controller, DocController, DocAction, Get, Post, Context} from "kwyjibo";
import * as K from "kwyjibo";
import * as Dockerode from "dockerode";
import * as Parser from "ansi-style-parser";
import App from "../app";
import * as Stream from "stream";
import * as OS from "os";

@Controller("/docker")
@DocController("Docker operations controller.")
class Docker {
    private dockerAPI: Dockerode = undefined;

    constructor() {
        this.dockerAPI = new Dockerode({ socketPath: "/var/run/docker.sock" });
    }

    private handleError(context: Context, error: any): void {
        context.response.status(500).send(error);
    }

    @Get("/")
    @DocAction("Redirects to /docker/containers")
    index(context: Context) {
        context.response.redirect("/docker/containers");
    }

    @Get("/auth")
    @DocAction(`Add authentication cookie`)
    authGet(context: Context): void {
        context.response.render('auth');
    }

    @Get("/oauth")
    @K.ActionMiddleware(App.authenticateMiddleware)
    @DocAction(`oAuth callback`)
    oauth(context: Context): void {
        context.response.redirect("/");
    }

    @Post("/auth")
    authPost(context: Context): void {
        let password = context.request.body.password;
        if (password != undefined) {
            context.response.cookie("auth", password);
        }

        context.response.redirect("/docker/containers");
    }

    @K.ActionMiddleware(App.authorizeMiddleware)
    @DocAction(`Lists existing containers`)
    containers(context: Context): void {
        this.dockerAPI.listContainers({ all: true }, (err, containers) => {
            if (err) {
                this.handleError(context, err);
                return;
            }
            context.response.render("containersList", { model: containers });
        });
    }

    @DocAction(`Starts a container`)
    @K.ActionMiddleware(App.authorizeMiddleware)
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

            context.response.redirect("/docker/containers");
        });
    }

    @DocAction(`Lists the content of a directory from a container`)
    @K.ActionMiddleware(App.authorizeMiddleware)
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
                        entries: []
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
                                action = "ls";
                            } else {
                                action = "getArchive";
                            }

                            let link = `/docker/${action}?id=${id}&path=${path + entryName}`;

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
    @K.ActionMiddleware(App.authorizeMiddleware)
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

            let fileName = path.split("/").join("__");

            context.response.setHeader("Content-Type", "application/octet-stream");
            context.response.setHeader("Content-Disposition", `attachment; filename="${fileName}.tar"`);
            stream.pipe(context.response);
        });
    }

    @DocAction(`Shows the logs for the container with the id sent in the querystring`)
    @K.ActionMiddleware(App.authorizeMiddleware)
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