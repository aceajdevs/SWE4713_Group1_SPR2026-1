import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock emailjs
const mockSend = vi.fn();
vi.mock('@emailjs/browser', () => ({
  default: { send: (...args) => mockSend(...args) },
}));

// Mock supabase (needed because emailService imports GoTrueClient)
vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

import { sendNewAccountRequest, sendAdminEmail, sendReportEmail } from '../services/emailService';

describe('emailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ══════════════════════════════════════════════
  // sendNewAccountRequest
  // ══════════════════════════════════════════════
  describe('sendNewAccountRequest', () => {
    it('calls emailjs.send with correct service and template', async () => {
      mockSend.mockResolvedValue({ status: 200 });

      await sendNewAccountRequest('John Doe');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        'service_h5dzete',
        'template_rot6eaf',
        expect.objectContaining({
          email: 'betterfinance3@gmail.com',
          name: 'John Doe',
        })
      );
    });

    it('passes the full name to the template params', async () => {
      mockSend.mockResolvedValue({ status: 200 });

      await sendNewAccountRequest('Jane Smith');
      const templateParams = mockSend.mock.calls[0][2];
      expect(templateParams.name).toBe('Jane Smith');
    });

    it('handles empty name string', async () => {
      mockSend.mockResolvedValue({ status: 200 });

      await sendNewAccountRequest('');
      const templateParams = mockSend.mock.calls[0][2];
      expect(templateParams.name).toBe('');
    });
  });

  // ══════════════════════════════════════════════
  // sendAdminEmail
  // ══════════════════════════════════════════════
  describe('sendAdminEmail', () => {
    it('sends an admin email with correct params', async () => {
      mockSend.mockResolvedValue({ status: 200 });

      const result = await sendAdminEmail(
        'user@example.com',
        'Alice',
        'Account Update',
        'Your role has been changed.'
      );

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        'service_h5dzete',
        'template_admin_email',
        expect.objectContaining({
          from_email: 'betterfinance3@gmail.com',
          to_email: 'user@example.com',
          to_name: 'Alice',
          subject: 'Account Update',
          message: 'Your role has been changed.',
        })
      );
    });

    it('throws on emailjs failure', async () => {
      mockSend.mockRejectedValue(new Error('SMTP error'));

      await expect(
        sendAdminEmail('user@example.com', 'Alice', 'Test', 'Body')
      ).rejects.toThrow('SMTP error');
    });

    it('returns true on success', async () => {
      mockSend.mockResolvedValue({ status: 200 });

      const result = await sendAdminEmail('a@b.com', 'Bob', 'Hi', 'Hello');
      expect(result).toBe(true);
    });
  });

  describe('sendReportEmail', () => {
    it('sends report email with report details in message', async () => {
      mockSend.mockResolvedValue({ status: 200 });

      const result = await sendReportEmail({
        recipientEmail: 'recipient@example.com',
        recipientName: 'Report User',
        reportTitle: 'Income Statement',
        reportHtml: '<h1>Income Statement</h1><p>Total Revenue</p>',
        generatedAt: '4/20/2026, 11:00:00 AM',
        pdfFilename: 'income-statement-2026-04-20.pdf',
        pdfBase64: 'JVBERi0xLjQKJ...',
      });

      expect(result).toEqual({ sent: true, attachmentIncluded: true });
      expect(mockSend).toHaveBeenCalledWith(
        'service_h5dzete',
        'template_admin_email',
        expect.objectContaining({
          to_email: 'recipient@example.com',
          to_name: 'Report User',
          subject: 'Income Statement - Generated Report',
          message: expect.stringContaining('Generated on: 4/20/2026, 11:00:00 AM'),
          report_pdf_filename: 'income-statement-2026-04-20.pdf',
          report_pdf_base64: 'JVBERi0xLjQKJ...',
          attachment_name: 'income-statement-2026-04-20.pdf',
          attachment_data: 'JVBERi0xLjQKJ...',
        })
      );
    });

    it('throws when recipient email is missing', async () => {
      await expect(
        sendReportEmail({
          recipientEmail: '   ',
          reportTitle: 'Trial Balance',
          reportHtml: '<p>Report</p>',
        })
      ).rejects.toThrow('Recipient email is required.');
    });

    it('falls back to non-attachment email when attachment send fails', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('Payload too large'))
        .mockResolvedValueOnce({ status: 200 });

      const result = await sendReportEmail({
        recipientEmail: 'recipient@example.com',
        recipientName: 'Report User',
        reportTitle: 'Balance Sheet',
        reportHtml: '<h1>Balance Sheet</h1>',
        pdfFilename: 'balance-sheet.pdf',
        pdfBase64: 'JVBERi0xLjQKJ...',
      });

      expect(result).toEqual({ sent: true, attachmentIncluded: false });
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});
