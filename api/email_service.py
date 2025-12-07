"""
Email service for Racket Pro Analyzer
Handles email verification codes and SendGrid integration
"""

import os
import random
import string
from datetime import datetime, timedelta
from typing import Optional
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

# SendGrid configuration
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@racket-pro-analyzer.com")
FROM_NAME = "Racket Pro Analyzer"

# Check if SendGrid is configured
if not SENDGRID_API_KEY:
    print("[EMAIL] WARNING: SENDGRID_API_KEY not set. Email verification will not work!")
    print("[EMAIL] Set SENDGRID_API_KEY environment variable to enable email verification.")


def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return ''.join(random.choices(string.digits, k=6))


def get_verification_code_expiry() -> datetime:
    """Get expiration time for verification code (30 minutes from now)"""
    return datetime.utcnow() + timedelta(minutes=30)


def send_verification_email(to_email: str, verification_code: str, user_name: str = "") -> bool:
    """
    Send email verification code to user

    Args:
        to_email: Recipient email address
        verification_code: 6-digit verification code
        user_name: Optional user name for personalization

    Returns:
        True if email sent successfully, False otherwise
    """
    if not SENDGRID_API_KEY:
        print(f"[EMAIL] Cannot send email - SENDGRID_API_KEY not configured")
        return False

    try:
        greeting = f"Olá {user_name}!" if user_name else "Olá!"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .code-box {{ background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }}
                .code {{ font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }}
                .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎾 Racket Pro Analyzer</h1>
                    <p>Verificação de Email</p>
                </div>
                <div class="content">
                    <h2>{greeting}</h2>
                    <p>Obrigado por se cadastrar no <strong>Racket Pro Analyzer</strong>!</p>
                    <p>Para ativar sua conta, utilize o código de verificação abaixo:</p>

                    <div class="code-box">
                        <div style="color: #666; font-size: 14px; margin-bottom: 10px;">SEU CÓDIGO DE VERIFICAÇÃO:</div>
                        <div class="code">{verification_code}</div>
                    </div>

                    <p><strong>⏰ Importante:</strong> Este código expira em <strong>30 minutos</strong>.</p>

                    <p>Se você não solicitou este cadastro, ignore este email.</p>

                    <hr style="border: 1px solid #e5e7eb; margin: 30px 0;">

                    <p style="font-size: 14px; color: #666;">
                        <strong>Dica:</strong> Após ativar sua conta, você terá acesso a:<br>
                        ✅ Registro de jogos em todos os esportes de raquete<br>
                        ✅ Estatísticas detalhadas por adversário<br>
                        ✅ Histórico completo de partidas<br>
                    </p>
                </div>
                <div class="footer">
                    <p>© 2025 Racket Pro Analyzer - Todos os direitos reservados</p>
                    <p>Este é um email automático, não responda.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        {greeting}

        Obrigado por se cadastrar no Racket Pro Analyzer!

        Para ativar sua conta, utilize o código de verificação abaixo:

        CÓDIGO: {verification_code}

        IMPORTANTE: Este código expira em 30 minutos.

        Se você não solicitou este cadastro, ignore este email.

        ---
        © 2025 Racket Pro Analyzer
        Este é um email automático, não responda.
        """

        message = Mail(
            from_email=Email(FROM_EMAIL, FROM_NAME),
            to_emails=To(to_email),
            subject="🎾 Verifique seu email - Racket Pro Analyzer",
            plain_text_content=Content("text/plain", text_content),
            html_content=Content("text/html", html_content)
        )

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)

        success = response.status_code in [200, 201, 202]
        if success:
            print(f"[EMAIL] Verification email sent to {to_email} - Status: {response.status_code}")
        else:
            print(f"[EMAIL] Failed to send email to {to_email} - Status: {response.status_code}")
        return success

    except Exception as e:
        print(f"[EMAIL] ===== ERROR SENDING EMAIL =====")
        print(f"[EMAIL] Error type: {type(e).__name__}")
        print(f"[EMAIL] Error message: {str(e)}")
        print(f"[EMAIL] Recipient: {to_email}")
        import traceback
        print(f"[EMAIL] Traceback: {traceback.format_exc()}")
        print(f"[EMAIL] ==============================")
        return False


def send_welcome_email(to_email: str, user_name: str = "") -> bool:
    """
    Send welcome email after successful verification
    """
    if not SENDGRID_API_KEY:
        return False

    try:
        greeting = f"Olá {user_name}!" if user_name else "Olá!"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .feature {{ background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #10b981; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Bem-vindo!</h1>
                    <p>Sua conta foi ativada com sucesso</p>
                </div>
                <div class="content">
                    <h2>{greeting}</h2>
                    <p>Parabéns! Sua conta no <strong>Racket Pro Analyzer</strong> está ativa e pronta para uso!</p>

                    <h3 style="color: #667eea; margin-top: 30px;">🚀 O que você pode fazer agora:</h3>

                    <div class="feature">
                        <strong>🎾 Múltiplos Esportes</strong><br>
                        Registre jogos de Tênis, Padel, Beach Tennis, Badminton, Squash, Pickleball e Tênis de Mesa.
                    </div>

                    <div class="feature">
                        <strong>📊 Estatísticas Detalhadas</strong><br>
                        Acompanhe seu desempenho contra cada adversário e parceiro.
                    </div>

                    <div class="feature">
                        <strong>🎯 Histórico Completo</strong><br>
                        Veja a evolução do seu jogo ao longo do tempo.
                    </div>

                    <p style="margin-top: 30px;">Bons jogos e que você alcance novos níveis! 🏆</p>
                </div>
            </div>
        </body>
        </html>
        """

        message = Mail(
            from_email=Email(FROM_EMAIL, FROM_NAME),
            to_emails=To(to_email),
            subject="🎉 Bem-vindo ao Racket Pro Analyzer!",
            html_content=Content("text/html", html_content)
        )

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)

        print(f"[EMAIL] Welcome email sent to {to_email} - Status: {response.status_code}")
        return response.status_code in [200, 201, 202]

    except Exception as e:
        print(f"[EMAIL] Error sending welcome email to {to_email}: {str(e)}")
        return False


def send_password_reset_email(to_email: str, reset_code: str, user_name: str = "") -> bool:
    """
    Send password reset code to user
    """
    if not SENDGRID_API_KEY:
        print(f"[EMAIL] Cannot send email - SENDGRID_API_KEY not configured")
        return False

    try:
        greeting = f"Olá {user_name}!" if user_name else "Olá!"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .code-box {{ background: white; border: 2px dashed #f59e0b; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }}
                .code {{ font-size: 32px; font-weight: bold; color: #f59e0b; letter-spacing: 8px; }}
                .warning {{ background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Redefinição de Senha</h1>
                    <p>Racket Pro Analyzer</p>
                </div>
                <div class="content">
                    <h2>{greeting}</h2>
                    <p>Você solicitou a redefinição de senha da sua conta no <strong>Racket Pro Analyzer</strong>.</p>
                    <p>Para criar uma nova senha, utilize o código de verificação abaixo:</p>

                    <div class="code-box">
                        <div style="color: #666; font-size: 14px; margin-bottom: 10px;">SEU CÓDIGO DE REDEFINIÇÃO:</div>
                        <div class="code">{reset_code}</div>
                    </div>

                    <p><strong>⏰ Importante:</strong> Este código expira em <strong>30 minutos</strong>.</p>

                    <div class="warning">
                        <strong>⚠️ Atenção:</strong> Se você não solicitou esta redefinição de senha, ignore este email e sua senha permanecerá inalterada.
                    </div>

                    <hr style="border: 1px solid #e5e7eb; margin: 30px 0;">

                    <p style="font-size: 14px; color: #666;">
                        <strong>Dica de Segurança:</strong><br>
                        ✅ Use uma senha forte (mínimo 6 caracteres)<br>
                        ✅ Não compartilhe sua senha com ninguém<br>
                        ✅ Nunca forneça códigos de verificação por email ou telefone<br>
                    </p>
                </div>
                <div class="footer">
                    <p>© 2025 Racket Pro Analyzer - Todos os direitos reservados</p>
                    <p>Este é um email automático, não responda.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        {greeting}

        Você solicitou a redefinição de senha da sua conta no Racket Pro Analyzer.

        Para criar uma nova senha, utilize o código de verificação abaixo:

        CÓDIGO: {reset_code}

        IMPORTANTE: Este código expira em 30 minutos.

        ATENÇÃO: Se você não solicitou esta redefinição de senha, ignore este email e sua senha permanecerá inalterada.

        ---
        © 2025 Racket Pro Analyzer
        Este é um email automático, não responda.
        """

        message = Mail(
            from_email=Email(FROM_EMAIL, FROM_NAME),
            to_emails=To(to_email),
            subject="🔐 Redefinição de Senha - Racket Pro Analyzer",
            plain_text_content=Content("text/plain", text_content),
            html_content=Content("text/html", html_content)
        )

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)

        success = response.status_code in [200, 201, 202]
        if success:
            print(f"[EMAIL] Password reset email sent to {to_email} - Status: {response.status_code}")
        else:
            print(f"[EMAIL] Failed to send password reset email to {to_email} - Status: {response.status_code}")
        return success

    except Exception as e:
        print(f"[EMAIL] ===== ERROR SENDING PASSWORD RESET EMAIL =====")
        print(f"[EMAIL] Error type: {type(e).__name__}")
        print(f"[EMAIL] Error message: {str(e)}")
        print(f"[EMAIL] Recipient: {to_email}")
        import traceback
        print(f"[EMAIL] Traceback: {traceback.format_exc()}")
        print(f"[EMAIL] ===============================================")
        return False
