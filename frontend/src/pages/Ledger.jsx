// TODO: Add journal entry rows to the ledger table once journal entries are implemented

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchFromTable } from '../supabaseUtils';
import '../global.css';

function Ledger() {
    const [account, setAccount] = useState(null);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { accountID } = useParams();

    useEffect(() => {
        loadLedger();
    }, [accountID]);

    const loadLedger = async () => {
        setLoading(true);
        setError(null);

        // Fetch account details
        const { data: accountData, error: accountError } = await fetchFromTable('chartOfAccounts', {
            filter: { column: 'accountID', operator: 'eq', value: accountID },
            single: true
        });

        if (accountError || !accountData) {
            setError('Failed to load account details. You may not have permission.');
            setLoading(false);
            return;
        }
        setAccount(accountData);
    };

}


export default Ledger;