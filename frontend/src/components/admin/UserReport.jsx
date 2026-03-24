import React, { useEffect, useState } from 'react';
import { getAllUsers } from '../../services/adminService';
import { sendAdminEmail } from '../../services/emailService';
import { HelpTooltip } from '../HelpTooltip';
import './UserReport.css';

function UserReport() {
    const [selectedUser, setSelectedUser] = useState(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailMessage, setEmailMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [users, setUsers] = useState([])

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            const data = await getAllUsers()
            setUsers(data)
        } catch (err) {
            console.error('Error fetching users:', err)
        }
    }

    const handleSendEmail = async () => {
        if (!emailSubject || !emailMessage) {
            alert("Subject and message required");
            return;
        }

        try {
            setSending(true);

            await sendAdminEmail(
            selectedUser.email,
            selectedUser.fName,
            emailSubject,
            emailMessage
            );

            alert("Email sent successfully");

            setEmailSubject("");
            setEmailMessage("");
            setSelectedUser(null);

        } catch (err) {
            console.error(err);
            alert("Failed to send email");
        } finally {
            setSending(false);
        }
    };

    return (
        <div>
            <h2>All Users</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.userID}>
                            <td>{user.userID}</td>
                            <td>{user.username}</td>
                            <td>{user.fName}</td>
                            <td>{user.lName}</td>
                            <td>{user.email}</td>
                            <td>{user.role}</td>
                            <td>{user.status ? "Active" : "Inactive"}</td>
                            <td>
                                <HelpTooltip text="Open the email composer for this user’s address.">
                                    <button type="button" onClick={() => setSelectedUser(user)}>
                                        Email
                                    </button>
                                </HelpTooltip>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {selectedUser && (
                <div style={{ marginTop: "30px", padding: "20px", border: "1px solid #ccc" }}>
                    <h3>Email {selectedUser.fName} ({selectedUser.email})</h3>

                    <input
                        type="text"
                        placeholder="Subject"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        style={{ width: "100%", marginBottom: "10px" }}
                    />

                    <textarea
                    placeholder="Message"
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    rows={6}
                    style={{ width: "100%", marginBottom: "10px" }}
                    />

                    <HelpTooltip text="Send the subject and message to this user using the configured email service.">
                        <button type="button" onClick={handleSendEmail} disabled={sending}>
                            {sending ? "Sending..." : "Send Email"}
                        </button>
                    </HelpTooltip>

                    <HelpTooltip text="Close the email panel without sending.">
                        <button type="button" onClick={() => setSelectedUser(null)} style={{ marginLeft: "10px" }}>
                            Cancel
                        </button>
                    </HelpTooltip>
                </div>
            )}
        </div>
    )
}

export default UserReport