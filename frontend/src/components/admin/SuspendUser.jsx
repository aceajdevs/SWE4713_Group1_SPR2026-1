import React, { useState, useEffect } from 'react';
import { suspendUser } from '../../services/adminService';
import { supabase } from '../../supabaseClient';
import { HelpTooltip } from '../HelpTooltip';

function SuspendUser() {
  const [userId, setUserId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeUsers, setActiveUsers] = useState([])

  useEffect(() => {
    const fetchActiveUsers = async () => {
      const { data, error } = await supabase
        .from('user')
        .select('userID, fName, lName, username')
        .eq('status', true)
        .order('lName', { ascending: true })
      if (error) {
        console.error('Error fetching active users:', error)
      } else {
        setActiveUsers(data || [])
      }
    }
    fetchActiveUsers()
  }, [])

  const handleSuspend = async () => {
    // Validate all fields are filled
    if (!userId || !startDate || !endDate) {
      alert('Please fill in all the fields before suspending a user.');
      return
    }

    // Validate end date comes after start date.
    if (new Date(endDate) <= new Date(startDate)) {
      alert('End date must be after the start date.');
      return
    }

    try {
      await suspendUser(userId, startDate, endDate)
      alert('User suspended successfully')
      setUserId('')
    } catch (err) {
      console.error('Error suspending user:', err)
    }
  }

  return (
    <div>
      <h2>Suspend User</h2>
      <div className="suspend-group-column">
        <div className="suspend-group-left">
          <h5>Start Date</h5>
          <input className="input-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        <select
          className="input"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">-- Select Active User --</option>
          {activeUsers.map((u) => (
            <option key={u.userID} value={u.userID}>
              {u.lName}, {u.fName} ({u.username})
            </option>
          ))}
        </select>
        </div>
        <div className="suspend-group-right">
          <h5>End Date</h5>
          <input className="input-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <HelpTooltip text="Apply a suspension window so the user cannot sign in between the start and end dates.">
            <button type="button" className="button-primary" onClick={handleSuspend}>Suspend User</button>
          </HelpTooltip>
        </div>
      </div>
    </div>
  )
}

export default SuspendUser