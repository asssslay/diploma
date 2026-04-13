import { Resend } from "resend";
import { env } from "@my-better-t-app/env/server";

export const resend = new Resend(env.RESEND_API_KEY);
