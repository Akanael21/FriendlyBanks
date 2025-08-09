import logging
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)

def send_password_email(email: str, password: str):
    subject = 'Vos identifiants FriendlyBanks'
    message = f'Bonjour,\n\nVotre compte a été créé avec succès.\nVotre mot de passe temporaire est : {password}\nVeuillez le changer dès votre première connexion.\n\nCordialement,\nL\'équipe FriendlyBanks'
    from_email = settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'no-reply@friendlybanks.com'
    try:
        send_mail(subject, message, from_email, [email])
        logger.info(f'Email sent to {email}')
    except Exception as e:
        logger.error(f'Failed to send email to {email}: {e}')

def send_password_whatsapp(phone: str, password: str):
    # Placeholder for WhatsApp sending logic
    # Real implementation requires WhatsApp Business API or third-party service
    logger.info(f'Simulated WhatsApp message to {phone}: Your temporary password is {password}')
    # You can integrate Twilio or other services here
