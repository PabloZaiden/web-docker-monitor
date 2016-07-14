import {Controller, DocController, DocAction, Get, ActionMiddleware, Context} from "kwyjibo";
import App from "../app";

@Controller("/oauth")
@DocController("OAuth controller.")
class OAuth {
   
    @Get("/callback")
    @ActionMiddleware(App.authenticate)
    @DocAction(`oAuth callback`)
    oauth(context: Context): void {
        context.response.redirect("/");
    }
}