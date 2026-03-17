/* eslint-disable */

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ token: 'fake-token' })
  })
)

test('logs in successfully', async () => {
  render(<Login />)

  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'test@test.com' }
  })

  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'password123' }
  })

  fireEvent.click(screen.getByRole('button', { name: /login/i }))

  expect(await screen.findByText(/welcome/i)).toBeInTheDocument()
})
