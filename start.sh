#!/bin/sh

# Process msmtp configuration with environment variables
echo "Setting up msmtp configuration..."
envsubst < /etc/msmtprc.template > /etc/msmtprc
chmod 600 /etc/msmtprc

echo "Starting AOSTP API..."
exec npm run start:prod
