import * as Express from "express";
import {Controller, DocController, DocAction, Get, Post, ExpressCompatible, Context} from "kwyjibo";
import * as K from "kwyjibo";
import * as Dockerode from "dockerode";
import * as Parser from "ansi-style-parser";
import * as Stream from "stream";
import EnvironmentAuth from "../middleware/environmentAuth";

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

    @Get("/auth")
    @DocAction(`Add authentication cookie`)
    authGet(context: Context): void {
        context.response.render('auth');
    }

    @Post("/auth")
    authPost(context: Context): void {
        let password = context.request.body.password;
        if (password != undefined) {
            context.response.cookie("auth", password);
        }

        context.response.redirect("/docker/containers");
    }

    @DocAction(`Lists existing containers`)
    @K.ActionMiddleware(EnvironmentAuth)
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
    @K.ActionMiddleware(EnvironmentAuth)
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

    @DocAction(`Shows the logs for the container with the id sent in the querystring`)
    @K.ActionMiddleware(EnvironmentAuth)
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

            var data = "";

            var logStream = new Stream.PassThrough();
            logStream.on("data", chunk => {
                data += chunk;
            });

            stream.on("end", () => {
                stream.destroy();
                let parts = Parser(data);

                let html = "";
                for (let p of parts) {
                    html += p.text;
                }
                context.response.send("<html><body><pre>" + html + "</pre></body></html>");
            });

            this.dockerAPI.modem.demuxStream(stream, logStream, logStream);
        });
    }
}