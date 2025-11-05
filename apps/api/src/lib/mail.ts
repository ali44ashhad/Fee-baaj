import config from '@/config';
import nodemailer from 'nodemailer';
import { renderEmailHtml, EmailTemplate, EmailTemplateProps } from '@elearning/mailer';

const transporter = nodemailer.createTransport({
    service: config.mail.service,
    auth: {
        user: config.mail.username,
        pass: config.mail.password,
    },
});

export interface SendTemplateParams<T extends EmailTemplate> {
    to: string | string[];
    subject: string;
    template: T;
    params: EmailTemplateProps[T];
}

const sendMail = async <T extends EmailTemplate>({ to, subject, template, params }: SendTemplateParams<T>) => {
    const html = await renderEmailHtml({ template, params });

    transporter.sendMail(
        {
            from: config.mail.from,
            to,
            subject,
            html,
        },
        function (error, info) {
            if (error) {
                console.log('Error:', error);
            } else {
                console.log('Email sent:', info.response);
            }
        },
    );
};

export default sendMail;
