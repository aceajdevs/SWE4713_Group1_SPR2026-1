import emailjs from '@emailjs/browser';
import { GoTrueClient } from '@supabase/supabase-js';

export async function sendNewAccountRequest(name){
    emailjs.send("service_h5dzete","template_rot6eaf",
        {
            email: "betterfinance3@gmail.com",
            name: name,
        }
    );
}

export async function sendAdminEmail(recipientEmail, recipientName, subject, message){
    try {
        const response = await emailjs.send(
            "service_h5dzete",
            "template_admin_email",
            {
                from_email: "betterfinance3@gmail.com",
                to_email: recipientEmail,
                to_name: recipientName,
                subject: subject,
                message: message,
            }
        );

        console.log("Admin email sent:", response.status);
        return true;
    } catch (error) {
        console.error("Admin email error:", error);
        throw error;
    }
}


export async function sendJournalPendingApprovalToManager({
    managerEmail,
    managerDisplayName,
    journalEntryId,
    submitterDisplayName,
}) {
    const email = String(managerEmail || '').trim();
    if (!email) return false;

    const subject = `Journal entry #${journalEntryId} submitted for approval`;
    const message =
        `A journal entry has been submitted and is pending your approval.\n\n` +
        `Entry ID: ${journalEntryId}\n` +
        `Submitted by: ${submitterDisplayName}\n\n` +
        `Please sign in and open Journal Entries to review and approve or reject it.`;

    return sendAdminEmail(email, managerDisplayName || 'Manager', subject, message);
}

function htmlToPlainText(html) {
    return String(html || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|tr)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

export async function sendReportEmail({
    recipientEmail,
    recipientName,
    reportTitle,
    reportHtml,
    generatedAt,
    pdfFilename,
    pdfBase64,
}) {
    const email = String(recipientEmail || '').trim();
    if (!email) {
        throw new Error('Recipient email is required.');
    }

    const title = String(reportTitle || 'Report').trim();
    const when = String(generatedAt || new Date().toLocaleString()).trim();
    const plainReport = htmlToPlainText(reportHtml);
    const message =
        `Please find the generated ${title} report details below.\n\n` +
        `Generated on: ${when}\n\n` +
        `${plainReport || 'No report content available.'}` +
        (pdfBase64 ? '\n\nA PDF copy of this report is attached.' : '');

    try {
        const response = await emailjs.send(
            "service_h5dzete",
            "template_admin_email",
            {
                from_email: "betterfinance3@gmail.com",
                to_email: email,
                to_name: String(recipientName || '').trim() || 'Recipient',
                subject: `${title} - Generated Report`,
                message,
                report_pdf_filename: String(pdfFilename || `${title}.pdf`),
                report_pdf_base64: pdfBase64 || '',
                attachment_name: String(pdfFilename || `${title}.pdf`),
                attachment_data: pdfBase64 || '',
            }
        );
        console.log("Report email sent:", response.status);
        return { sent: true, attachmentIncluded: Boolean(pdfBase64) };
    } catch (error) {
        console.error("Report email with attachment error:", error);
        // Fallback: send without attachment so delivery still succeeds.
        try {
            const fallbackMessage =
                `${message}\n\n` +
                `Note: PDF attachment could not be included by the email provider for this send.`;
            await sendAdminEmail(
                email,
                String(recipientName || '').trim() || 'Recipient',
                `${title} - Generated Report`,
                fallbackMessage,
            );
            return { sent: true, attachmentIncluded: false };
        } catch (fallbackError) {
            console.error("Report email fallback error:", fallbackError);
            throw fallbackError;
        }
    }
}

// import nodemailer from 'nodemailer';

// //https://nodemailer.com/usage/using-gmail

// const recipientAddress = "";
// const sendAddress = "";
// const subject = "example subject";
// const message = "example message";

// // Should be an env variable
// // Creates app password through gmail account settings
// const appPassword = "svnchjolulhkdhjv";

// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: sendAddress,
//         pass: appPassword,

//     }
// });

// const mailOptions = {
//     from: sendAddress,
//     to: recipientAddress,
//     subject: subject,
//     text: message,

// };


// export async function sendEmail(recipientAddress, subject, message){
//     try {
//         const info = await transporter.sendMail(mailOptions);
//         console.log('Email sent successfully:', info.response);
//     } catch (error) {
//         console.log('Error occurred:', error);
//     }
// }

