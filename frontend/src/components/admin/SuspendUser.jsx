import React, { useState } from 'react';
import { suspendUser } from '../../services/adminService';

function SuspendUser() {
  const [userId, setUserId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleSuspend = async () => {
    try {
      await suspendUser(userId, startDate, endDate)
      alert('User suspended successfully')
    } catch (err) {
      console.error('Error suspending user:', err)
    }
  }

  return (
    <div>
      <h2>Suspend User</h2>

      <input
        type="text"
        placeholder="User ID"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
      />

      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />

      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
      />

      <button onClick={handleSuspend}>Suspend</button>
    </div>
  )
}

export default SuspendUser