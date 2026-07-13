use sb_notification::TelegramNotificationService;

#[tokio::test]
async fn telegram_service_can_be_created() {
    let _svc = TelegramNotificationService::new("dummy_token".to_string());
}
