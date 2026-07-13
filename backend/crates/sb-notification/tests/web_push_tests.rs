use wiremock::{matchers::method, Mock, MockServer, ResponseTemplate};
use sb_notification::web_push::{WebPushSender, SendOutcome};
use sb_db_entities::push_subscription::Model;
use base64::Engine;
use uuid::Uuid;
use chrono::Utc;
use openssl::bn::BigNumContext;
use openssl::ec::{EcGroup, EcKey, PointConversionForm};
use openssl::nid::Nid;
use openssl::pkey::PKey;

fn create_test_subscription(endpoint: String) -> Model {
    let group = EcGroup::from_curve_name(Nid::X9_62_PRIME256V1).unwrap();
    let ec_key = EcKey::generate(&group).unwrap();
    let mut ctx = BigNumContext::new().unwrap();
    let pub_key_bytes = ec_key.public_key().to_bytes(&group, PointConversionForm::UNCOMPRESSED, &mut ctx).unwrap();
    let p256dh = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&pub_key_bytes);

    let mut auth_bytes = [0u8; 16];
    openssl::rand::rand_bytes(&mut auth_bytes).unwrap();
    let auth = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(auth_bytes);

    Model {
        id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        endpoint,
        p256dh,
        auth,
        expiration_time: None,
        created_at: Utc::now(),
    }
}

fn create_sender() -> WebPushSender {
    let group = EcGroup::from_curve_name(Nid::X9_62_PRIME256V1).unwrap();
    let ec_key = EcKey::generate(&group).unwrap();
    let pkey = PKey::from_ec_key(ec_key).unwrap();
    let private_key_pem_bytes = pkey.private_key_to_pem_pkcs8().unwrap();
    let private_key_pem = String::from_utf8(private_key_pem_bytes).unwrap();

    WebPushSender::new(private_key_pem, "mailto:test@test.com".to_string()).unwrap()
}

#[tokio::test]
async fn test_send_push_gone() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(410))
        .mount(&mock_server)
        .await;

    let sender = create_sender();
    let sub = create_test_subscription(mock_server.uri());

    let outcome = sender.send(&sub, "{}".to_string()).await.unwrap();
    assert!(matches!(outcome, SendOutcome::Gone));
}

#[tokio::test]
async fn test_send_push_delivered() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(201))
        .mount(&mock_server)
        .await;

    let sender = create_sender();
    let sub = create_test_subscription(mock_server.uri());

    let outcome = sender.send(&sub, "{}".to_string()).await.unwrap();
    assert!(matches!(outcome, SendOutcome::Delivered));
}
