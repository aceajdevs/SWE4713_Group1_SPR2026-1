import React, { useEffect, useState } from 'react';
import { getAllUsers } from '../../services/adminService';

function UserReport() {
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

    return (
        <div>
            <h2>All Users</h2>
            <table border="1">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
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
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export default UserReport