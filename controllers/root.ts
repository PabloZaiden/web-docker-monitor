import {Controller, DocController, DocAction, Get, ActionMiddleware, Context} from "kwyjibo";
import App from "../app";

@Controller("/")
@DocController("Root controller.")
class Root {
   
    @Get("/")
    @ActionMiddleware(App.authenticateMiddleware)
    @DocAction(`oAuth callback`)
    oauth(context: Context): void {
        context.response.redirect("/docker");
    }
}