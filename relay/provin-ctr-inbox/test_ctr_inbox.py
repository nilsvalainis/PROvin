"""python3 -m unittest relay/provin-ctr-inbox/test_ctr_inbox.py (anonimizēti paraugi, bez tīkla)."""

import os
import sys
import unittest
from email.message import EmailMessage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ctr_inbox as c  # noqa: E402

VIN = "VF1TEST0000000001"


def mail(subject: str, body: str, sender: str = "CheckThisReg <noreply@checkthisreg.com>") -> bytes:
    m = EmailMessage()
    m["From"] = sender
    m["To"] = "owner@example.com"
    m["Subject"] = subject
    m["Date"] = "Fri, 27 Nov 2026 16:59:10 +0000"
    m["Message-ID"] = "<test-1@checkthisreg.com>"
    m.set_content(body)
    return bytes(m)


READY = f"""Your Report is Complete!

ORDER DETAILS:
- Order Number: 20261127-ABCDEF
- Report Type: Service History Check
- Manufacturer: Renault
- Vehicle ID: {VIN}

DOWNLOAD YOUR REPORT:
https://checkthisreg.com/guest/token_1700000000000_ABCDEF?token=abcDEF123456

This link will expire in 30 days.
"""

UPDATE = f"""Update About Your Report

We could not find complete information for this vehicle, but any available files are ready to view.

ORDER DETAILS:
- Order Number: 20261127-XYZXYZ
- Manufacturer: Honda
- Vehicle ID: {VIN}

VIEW AVAILABLE FILES:
https://checkthisreg.com/guest/token_1700000000001_XYZXYZ?token=zzzZZZ999999

REFUND OPTIONS:
You can request website credits for this order.
"""


class ParseEmail(unittest.TestCase):
    def test_ready(self):
        info = c.parse_ctr_email(mail("Your Report is Ready! - 20261127-ABCDEF | CheckThisReg", READY))
        self.assertEqual(info["kind"], "ready")
        self.assertEqual(info["orderNumber"], "20261127-ABCDEF")
        self.assertEqual(info["vin"], VIN)
        self.assertEqual(info["manufacturer"], "Renault")
        self.assertEqual(info["guestId"], "token_1700000000000_ABCDEF")
        self.assertEqual(info["guestToken"], "abcDEF123456")
        self.assertTrue(info["receivedAt"].startswith("2026-11-27"))

    def test_update(self):
        info = c.parse_ctr_email(mail("Update About Your Order - 20261127-XYZXYZ | CheckThisReg", UPDATE))
        self.assertEqual(info["kind"], "update")
        self.assertEqual(info["manufacturer"], "Honda")

    def test_ignored(self):
        self.assertIsNone(c.parse_ctr_email(mail("Order Confirmation - 20261127-ABCDEF | CheckThisReg", READY)))
        self.assertIsNone(c.parse_ctr_email(mail("Refund Processed - 20261127-ABCDEF | CheckThisReg", READY)))
        self.assertIsNone(c.parse_ctr_email(mail("Your Report is Ready!", READY, sender="x@example.com")))


class Guard(unittest.TestCase):
    def test_only_get_order(self):
        c.guard_ctr_url("https://checkthisreg.com/api/guest/order/token_1_ABCDEF?token=x", "GET")
        c.guard_ctr_url("https://storage.googleapis.com/checkthisreg.firebasestorage.app/orders/token_1_ABCDEF/1_2018-07-19.pdf", "GET")
        for url, method in [
            ("https://checkthisreg.com/api/guest/order/token_1_ABCDEF?token=x", "POST"),
            ("https://checkthisreg.com/api/guest/order/token_1_ABCDEF/refund?token=x", "GET"),
            ("https://checkthisreg.com/api/tokens/redeem", "GET"),
            ("https://checkthisreg.com/api/purchase", "GET"),
            ("https://storage.googleapis.com/other-bucket/x.pdf", "GET"),
            ("http://checkthisreg.com/api/guest/order/token_1_ABCDEF", "GET"),
            ("https://evil.example.com/api/guest/order/token_1_ABCDEF", "GET"),
        ]:
            with self.assertRaises(PermissionError, msg=url):
                c.guard_ctr_url(url, method)

    def test_redact(self):
        self.assertNotIn("abc123", c.redact("GET https://checkthisreg.com/guest/x?token=abc123 Bearer abc123"))


class State(unittest.TestCase):
    def test_retry_not_done(self):
        self.assertFalse(c.is_done(None))
        self.assertFalse(c.is_done({"status": "retry"}))
        self.assertTrue(c.is_done({"status": "done"}))
        self.assertTrue(c.is_done({"status": "baseline"}))
        self.assertTrue(c.is_done({"status": "failed"}))


if __name__ == "__main__":
    unittest.main()
