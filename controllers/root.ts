import {Controller, DocController, DocAction, Get, ActionMiddleware, Context} from "kwyjibo";
import App from "../app";

@Controller("/")
@DocController("Root controller.")
class Root {
   
    @Get("/")
    @DocAction(`Redirect to docker controller`)
    oauth(context: Context): void {
        context.response.redirect("/docker");
    }
}