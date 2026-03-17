import '@testing-library/jest-dom';

import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
    globalThis.crypto = webcrypto;
}