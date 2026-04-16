from unittest.mock import patch, MagicMock

from exsize.database import create_db_engine


class TestCreateDbEngine:
    def test_sqlite_url_sets_check_same_thread_false(self):
        with patch("exsize.database.create_engine") as mock_create:
            mock_create.return_value = MagicMock()
            create_db_engine("sqlite:///exsize.db")
            mock_create.assert_called_once_with(
                "sqlite:///exsize.db",
                connect_args={"check_same_thread": False},
            )

    def test_postgresql_url_has_no_connect_args(self):
        with patch("exsize.database.create_engine") as mock_create:
            mock_create.return_value = MagicMock()
            create_db_engine("postgresql://user:pass@host/db")
            mock_create.assert_called_once_with("postgresql://user:pass@host/db")
