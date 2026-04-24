"""Tests for app/routers/utils.py — preserve_file_permissions()."""

import os
import stat
from unittest.mock import patch

import pytest

from app.routers.utils import preserve_file_permissions

unix_only = pytest.mark.skipif(os.name == "nt", reason="chmod has no effect on Windows")


class TestPreserveFilePermissions:
    @unix_only
    def test_sets_644_on_basic_list(self, tmp_path):
        f = tmp_path / "basic-list.json"
        f.write_text("{}")
        preserve_file_permissions(str(f))
        assert stat.S_IMODE(os.stat(str(f)).st_mode) == 0o644

    @unix_only
    def test_sets_644_on_advance_list(self, tmp_path):
        f = tmp_path / "advance-list.json"
        f.write_text("{}")
        preserve_file_permissions(str(f))
        assert stat.S_IMODE(os.stat(str(f)).st_mode) == 0o644

    @unix_only
    def test_corrects_overly_permissive_mode(self, tmp_path):
        f = tmp_path / "basic-list.json"
        f.write_text("{}")
        os.chmod(str(f), 0o777)
        preserve_file_permissions(str(f))
        assert stat.S_IMODE(os.stat(str(f)).st_mode) == 0o644

    @unix_only
    def test_corrects_too_restrictive_mode(self, tmp_path):
        f = tmp_path / "basic-list.json"
        f.write_text("{}")
        os.chmod(str(f), 0o600)
        preserve_file_permissions(str(f))
        assert stat.S_IMODE(os.stat(str(f)).st_mode) == 0o644

    @unix_only
    def test_ignores_other_filenames(self, tmp_path):
        f = tmp_path / "other-file.json"
        f.write_text("{}")
        os.chmod(str(f), 0o600)
        preserve_file_permissions(str(f))
        assert stat.S_IMODE(os.stat(str(f)).st_mode) == 0o600

    def test_only_acts_on_known_filenames(self, tmp_path):
        """Verifies the filename guard without relying on chmod behaviour."""
        f = tmp_path / "other-file.json"
        f.write_text("{}")
        with patch("os.chmod") as mock_chmod:
            preserve_file_permissions(str(f))
            mock_chmod.assert_not_called()

    def test_calls_chmod_for_basic_list(self, tmp_path):
        f = tmp_path / "basic-list.json"
        f.write_text("{}")
        with patch("os.chmod") as mock_chmod:
            preserve_file_permissions(str(f))
            mock_chmod.assert_called_once_with(str(f), 0o644)

    def test_calls_chmod_for_advance_list(self, tmp_path):
        f = tmp_path / "advance-list.json"
        f.write_text("{}")
        with patch("os.chmod") as mock_chmod:
            preserve_file_permissions(str(f))
            mock_chmod.assert_called_once_with(str(f), 0o644)

    def test_logs_warning_when_chmod_fails(self, tmp_path):
        f = tmp_path / "basic-list.json"
        f.write_text("{}")
        with patch("os.chmod", side_effect=PermissionError("denied")):
            with patch("app.routers.utils.logger") as mock_logger:
                preserve_file_permissions(str(f))
                mock_logger.warning.assert_called_once()

    def test_does_not_raise_when_chmod_fails(self, tmp_path):
        f = tmp_path / "basic-list.json"
        f.write_text("{}")
        with patch("os.chmod", side_effect=OSError("disk error")):
            preserve_file_permissions(str(f))  # must not raise
