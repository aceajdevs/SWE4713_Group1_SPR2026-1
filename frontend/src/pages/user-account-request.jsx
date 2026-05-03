import React, { useEffect, useState } from 'react';
import '../global.css';
import './user-account-request.css';
import { getAllUserRequests, approveUserRequest, rejectUserRequest } from '../services/userService';
import { useAuth } from '../AuthContext';
import { HelpTooltip } from '../components/HelpTooltip';

const ROLES = ['administrator', 'manager', 'accountant'];

function UserAccountRequestPage() {
    const { user: currentUser } = useAuth();
    const [requests, setRequests] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            setError('');
            const fetchedRequests = await getAllUserRequests();
            setRequests(fetchedRequests || []);

            if (
                selectedUserId &&
                !(fetchedRequests || []).some((r) => String(r.userID) === String(selectedUserId))
            ) {
                setSelectedUserId('');
                setSelectedRole('');
            }
        } catch (err) {
            console.error('Error fetching user requests:', err);
            setError('Failed to load user account requests.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectChange = (e) => {
        const value = e.target.value;
        setSelectedUserId(value);
        setSelectedRole('');
    };

    const handleRoleChange = (e) => {
        setSelectedRole(e.target.value);
    };

    const handleReject = async () => {
        if (!selectedUserId) {
            alert('Please select a user request to reject.');
            return;
        }
        
        if (!window.confirm('Are you sure you want to reject this user request? This action cannot be undone.')) {
            return;
        }

        try {
            setLoading(true);
            setError('');
            
            if (!currentUser?.userID) {
                throw new Error('Admin userID not found for audit logging.');
            }

            await rejectUserRequest(Number(selectedUserId), currentUser.userID);

            setSelectedUserId('');
            setSelectedRole('');
            
            
            await fetchRequests();
            
            alert('User request rejected and removed successfully.');
        } catch (err) {
            console.error('Error rejecting user request:', err);
            setError(`Failed to reject user request: ${err.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedUserId) {
            alert('Please select a user request.');
            return;
        }
        if (!selectedRole) {
            alert('Please select a role before approving.');
            return;
        }

        if (!window.confirm('Approve this user request and create the user account?')) {
            return;
        }

        try {
            setLoading(true);
            setError('');

            if (!currentUser?.userID) {
                throw new Error('Admin userID not found for audit logging.');
            }

            const createdUser = await approveUserRequest(
                Number(selectedUserId),
                selectedRole,
                currentUser.userID
            );
            console.log('Approved user:', createdUser);
            const emailSent = createdUser?.accountCreationEmailSent !== false;
            if (emailSent) {
                alert('User request approved. Account was created and an email was sent to the new user.');
            } else {
                alert('User request approved and account was created, but the approval email could not be delivered.');
            }

            await fetchRequests();
        } catch (err) {
            console.error('Error approving user request:', err);
            setError('Failed to approve user request.');
        } finally {
            setLoading(false);
        }
    };

    const selectedRequest = requests.find(
        (req) => String(req.userID) === String(selectedUserId)
    );

    return (
        <div className="page-container">
            <h1>User Account Requests</h1>

            {error && <p style={{ color: 'var(--error-color)' }}>{error}</p>}

            <section className="pending-requests" style={{ marginBottom: '1.5rem' }}>
                <h2>Pending Requests</h2>
                {loading && <p>Loading...</p>}
                {!loading && requests.length === 0 && <p>No pending user account requests.</p>}

                {requests.length > 0 && (
                    <table>
                        <thead>
                            <tr>
                                <th>User Request ID</th>
                                <th>Email</th>
                                <th>Username</th>
                                <th>First Name</th>
                                <th>Last Name</th>
                                <th>DOB</th>
                                <th>Address</th>
                                <th>Created At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map((req) => (
                                <tr key={req.userID}>
                                    <td>{req.userID}</td>
                                    <td>{req.email}</td>
                                    <td>{req.username}</td>
                                    <td>{req.fName}</td>
                                    <td>{req.lName}</td>
                                    <td>{req.dob}</td>
                                    <td>{req.address}</td>
                                    <td>{req.createdAt}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <section className="review-decision">
                <h2>Review & Decision</h2>
                <div style={{ marginBottom: '1rem' }}>
                    <label>
                        Select User Request ID:{' '}
                        <select className="input"
                            value={selectedUserId}
                            onChange={handleSelectChange}
                        >
                            <option value="">-- Select User ID --</option>
                            {requests.map((req) => (
                                <option key={req.userID} value={req.userID}>
                                    {req.userID} - {req.email}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {selectedRequest && (
                    <div style={{ marginBottom: '1rem' }}>
                        <h3>Selected User Details</h3>
                        <p><strong>Username:</strong> {selectedRequest.username}</p>
                        <p><strong>Name:</strong> {selectedRequest.fName} {selectedRequest.lName}</p>
                        <p><strong>Email:</strong> {selectedRequest.email}</p>
                        <p><strong>DOB:</strong> {selectedRequest.dob}</p>
                        <p><strong>Address:</strong> {selectedRequest.address}</p>
                    </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                    <label>
                        Assign Role:{' '}
                        <select className="input"
                            value={selectedRole}
                            onChange={handleRoleChange}
                            disabled={!selectedUserId}
                        >
                            <option value="">-- Select Role --</option>
                            {ROLES.map((role) => (
                                <option key={role} value={role}>
                                    {role}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <HelpTooltip text="Create an account for the selected request with the chosen role.">
                        <button
                            type="button"
                            className="button-primary"
                            disabled={!selectedUserId || loading}
                            onClick={handleApprove}
                        >
                            Approve
                        </button>
                    </HelpTooltip>
                    <HelpTooltip text="Decline this account request and remove it from the pending list.">
                        <button
                            type="button"
                            className="button-primary"
                            disabled={!selectedUserId || loading}
                            onClick={handleReject}
                        >
                            Reject
                        </button>
                    </HelpTooltip>
                </div>
            </section>
        </div>
    );
}

export default UserAccountRequestPage;

