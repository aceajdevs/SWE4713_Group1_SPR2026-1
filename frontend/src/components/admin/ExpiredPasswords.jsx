import React, { useEffect, useState } from 'react';
import { getExpiredPasswords } from '../../services/adminService';

function ExpiredPasswords() {
  const [passwords, setPasswords] = useState([])

  useEffect(() => {
    fetchExpired()
  }, [])

  const fetchExpired = async () => {
    try {
      const data = await getExpiredPasswords()
      setPasswords(data)
    } catch (err) {
      console.error('Error fetching expired passwords:', err)
    }
  }

  return (
    <div>
      <h2>Expired Passwords</h2>
      <table border="1">
        <thead>
          <tr>
            <th>User ID</th>
            <th>Expired On</th>
          </tr>
        </thead>
        <tbody>
          {passwords.map(p => (
            <tr key={p.passwordID}>
                <td>{p.userID}</td>
                <td>{p.activeTill}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ExpiredPasswords