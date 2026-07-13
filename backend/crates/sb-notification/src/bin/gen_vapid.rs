use openssl::ec::{EcGroup, EcKey};
use openssl::nid::Nid;
use openssl::pkey::PKey;
use base64::Engine;

fn main() {
    let group = EcGroup::from_curve_name(Nid::X9_62_PRIME256V1).unwrap();
    let ec_key = EcKey::generate(&group).unwrap();
    let pkey = PKey::from_ec_key(ec_key).unwrap();

    let private_pem = pkey.private_key_to_pem_pkcs8().unwrap();
    let private_pem_str = String::from_utf8(private_pem).unwrap();

    let public_der = pkey.public_key_to_der().unwrap();
    let public_b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&public_der);

    println!("--- VAPID Private Key (PEM) ---");
    println!("{}", private_pem_str);
    println!("--- VAPID Public Key (Base64URL) ---");
    println!("{}", public_b64);
}
