use anchor_lang::prelude::*;

declare_id!("BcKXZDdJ2M6oWy73Kve4VCGrhPsFqBN1rLZagVmkPKb6");

pub const CERTIFICATE_SEED: &[u8] = b"certificate";
pub const ACTIVE: u8 = 0;
pub const REVOKED: u8 = 1;

#[program]
pub mod certificate_registry {
    use super::*;

    pub fn issue_certificate(
        ctx: Context<IssueCertificate>,
        cert_hash: [u8; 32],
        student: Pubkey,
        metadata_cid: [u8; 64],
    ) -> Result<()> {
        let certificate = &mut ctx.accounts.certificate;
        certificate.cert_hash = cert_hash;
        certificate.issuer = ctx.accounts.issuer.key();
        certificate.student = student;
        certificate.metadata_cid = metadata_cid;
        certificate.status = ACTIVE;
        certificate.created_at = Clock::get()?.unix_timestamp;
        certificate.bump = ctx.bumps.certificate;
        Ok(())
    }

    pub fn revoke_certificate(
        ctx: Context<RevokeCertificate>,
        cert_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            ctx.accounts.certificate.cert_hash == cert_hash,
            CertificateError::HashMismatch
        );
        ctx.accounts.certificate.status = REVOKED;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(cert_hash: [u8; 32])]
pub struct IssueCertificate<'info> {
    #[account(
        init,
        payer = issuer,
        space = 8 + CertificateAccount::INIT_SPACE,
        seeds = [CERTIFICATE_SEED, cert_hash.as_ref()],
        bump
    )]
    pub certificate: Account<'info, CertificateAccount>,
    #[account(mut)]
    pub issuer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(cert_hash: [u8; 32])]
pub struct RevokeCertificate<'info> {
    #[account(
        mut,
        seeds = [CERTIFICATE_SEED, cert_hash.as_ref()],
        bump = certificate.bump,
        has_one = issuer @ CertificateError::UnauthorizedIssuer
    )]
    pub certificate: Account<'info, CertificateAccount>,
    pub issuer: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct CertificateAccount {
    pub cert_hash: [u8; 32],
    pub issuer: Pubkey,
    pub student: Pubkey,
    pub metadata_cid: [u8; 64],
    pub status: u8,
    pub created_at: i64,
    pub bump: u8,
}

#[error_code]
pub enum CertificateError {
    #[msg("Only the original issuer can revoke this certificate")]
    UnauthorizedIssuer,
    #[msg("The supplied hash does not match the certificate account")]
    HashMismatch,
}
