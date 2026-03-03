export async function sendNewAccountRequest(name){
    emailjs.send("service_h5dzete","template_rot6eaf",
        {
            email: "betterfinance3@gmail.com",
            name: name,
        }
    );
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

