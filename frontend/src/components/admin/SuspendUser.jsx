import React, { useState } from 'react';
import { suspendUser } from '../../services/adminService';
import { supabase } from '../../supabaseClient';
import { HelpTooltip } from '../HelpTooltip';

function SuspendUser() {
  const [userId, setUserId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleSuspend = async () => {
    // Validate all fields are filled
    if (!userId.trim() || !startDate || !endDate) {
      alert('Please fill in all the fields before suspending a user.');
      return
    }

    // Validate end date comes after start date.
    if (new Date(endDate) <= new Date(startDate)) {
      alert('End date must be after the start date.');
      return
    }

    try {
      // Check if user exists before suspending
      const {data: user, error} = await supabase
      .from('user')
      .select('userID')
      .eq('userID', userId.trim())
      .single();

      if (error || !user)
      {
        alert('User ID not found. Please enter a valid User ID.')
        return;
      }

      await suspendUser(userId, startDate, endDate)
      alert('User suspended successfully')
    } catch (err) {
      console.error('Error suspending user:', err)
    }
  }

  return (
    <div>
      <h2>Suspend User</h2>
      <div className="suspend-group-column">
        <div className="suspend-group-left">
          <h5>Suspension Start Date</h5>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        <div className="clear-input-container">
        <input
          type="text"
          placeholder="User ID"
          className="input"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <button type="button" className="button-clear" onClick={() => setUserId('')}>X</button>
      </div>
        </div>
        <div className="suspend-group-right">
          <h5>Suspension End Date</h5>
          <input
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