# VNPAY PAY sandbox adapter

`NewClient(tmnCode, hashSecret)` receives credentials from runtime configuration;
never commit them or pass them as Docker build arguments. `CheckoutURL` creates
a signed VNPAY 2.1.0 payment URL. The transaction reference must be a unique
alphanumeric value for each payment attempt; a booking UUID with hyphens cannot
be used directly. The caller supplies the server-calculated VND amount and the
booking hold's expiry time.

`VerifyNotification` checks HMAC-SHA512 and returns the provider's reference,
amount, transaction ID, and status. The application use case loads the pending
attempt, compares the amount, handles repeated IPNs idempotently, and confirms
the booking only if the hold is still valid. A browser redirect to the Return
URL is for display and does not confirm the booking. VNPAY needs a publicly
reachable HTTPS IPN endpoint for end-to-end sandbox integration.

Protocol reference: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
