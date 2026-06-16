"""Parsing do payload GET /instance/connect (Evolution)."""

from evolution_service import (
    connect_payload_reports_error,
    extract_pairing_from_connect_payload,
    extract_qr_base64_from_connect_payload,
)


def test_extract_qr_from_nested_qrcode_object():
    png = "iVBORw0KGgo" + ("A" * 120)
    raw = {"count": 1, "qrcode": {"base64": f"data:image/png;base64,{png}", "code": "2@xyz"}}
    got = extract_qr_base64_from_connect_payload(raw)
    assert got is not None
    assert "iVBOR" in got


def test_extract_pairing_flat():
    raw = {"pairingCode": "ABCD12XY", "code": "2@sessionrefnotimage", "count": 1}
    assert extract_qr_base64_from_connect_payload(raw) is None
    assert extract_pairing_from_connect_payload(raw) == "ABCD12XY"


def test_connect_error_flag():
    raw = {"error": True, "message": "BadRequestException: instance does not exist"}
    assert connect_payload_reports_error(raw) is not None


def test_flatten_instance_wrapper():
    inner = {"instanceName": "sk_x", "status": "close"}
    qr_png = "iVBORw0KGgo" + ("B" * 120)
    raw = {"instance": inner, "qrcode": {"base64": qr_png}}
    assert extract_qr_base64_from_connect_payload(raw) is not None
