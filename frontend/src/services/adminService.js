import { supabase } from '../supabaseClient'

// Get all users
export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('user')
    .select('*')
    .order('userID', {ascending: true})
  if (error) {
    console.error(error)
    throw error
  }

  return data
}

// Get expired passwords
export const getExpiredPasswords = async () => {
  const today = new Date().toISOString()

  const { data, error } = await supabase
    .from('userPasswords')
    .select('*')
    .lt('activeTill', today)

  if (error) {
    console.error(error)
    throw error
  }

  return data
}

// Suspend user
export const suspendUser = async (userID, startDate, endDate) => {
  const { data, error } = await supabase
    .from('user')
    .update({
      suspendFrom: startDate,
      suspendedTill: endDate,
      status: false
    })
    .eq('userID', userID)
    .select()

  if (error) {
    console.error("Supabase suspend error:", error)
    throw error
  }

  if (!data || data.length === 0) {
    throw new Error("User not found.")
  }

  return data
}