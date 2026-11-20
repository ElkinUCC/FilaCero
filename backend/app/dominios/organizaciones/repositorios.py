"""Acceso a datos de la organización (tenant)."""

from app import db


def confirmar():
    db.session.commit()


def deshacer():
    db.session.rollback()
