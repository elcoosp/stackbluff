use anyhow::{Context, Result};
use femtovg::{Canvas, Color, FontId, ImageFlags, ImgRef, Paint, Path};
use glow::HasContext;
use glutin::{
    config::{ConfigTemplateBuilder, SurfaceType},
    context::{ContextAttributesBuilder, NotCurrentGlContext, PossiblyCurrentContext},
    display::GetGlDisplay,
    prelude::GlDisplay,
    surface::{Surface, SurfaceAttributesBuilder, SurfaceTypeTrait},
};
use std::num::NonZeroU32;

pub struct FemtoRenderer {
    _context: PossiblyCurrentContext,
    _surface: Surface<impl SurfaceTypeTrait>,
    canvas: Canvas<femtovg::renderer::OpenGl>,
    width: u32,
    height: u32,
    font_id: Option<FontId>,
}

impl FemtoRenderer {
    pub fn new(width: u32, height: u32) -> Result<Self> {
        // Headless display and config
        let display =
            glutin::display::Display::new(glutin::api::DisplayApiPreference::default().into())?;
        let config_template = ConfigTemplateBuilder::new()
            .with_alpha_size(8)
            .with_surface_type(SurfaceType::PixelBuffer { width, height });
        let config = unsafe {
            display
                .find_configs(config_template)?
                .next()
                .context("No suitable config")?
        };
        let surface_attrs = SurfaceAttributesBuilder::<glutin::surface::PixelBufferSurface>::new()
            .build(
                NonZeroU32::new(width).unwrap(),
                NonZeroU32::new(height).unwrap(),
            );
        let surface = unsafe { display.create_pixel_buffer_surface(&config, &surface_attrs)? };
        let context_attrs = ContextAttributesBuilder::new().build(None);
        let context = unsafe { display.create_context(&config, &context_attrs)? };
        let context = context.make_current(&surface)?;

        let gl = unsafe { glow::Context::from_current_context() };
        let renderer = unsafe {
            femtovg::renderer::OpenGl::new_from_function(|s| {
                let cstr = std::ffi::CString::new(s).unwrap();
                gl.get_proc_address(cstr.as_c_str())
            })
        }?;
        let mut canvas = Canvas::new(renderer)?;
        canvas.set_size(width, height, 1.0);

        Ok(Self {
            _context: context,
            _surface: surface,
            canvas,
            width,
            height,
            font_id: None,
        })
    }

    pub fn load_font(&mut self, font_data: &[u8]) -> Result<()> {
        let id = self.canvas.add_font_mem(font_data)?;
        self.font_id = Some(id);
        Ok(())
    }

    pub fn begin_frame(&mut self) {
        self.canvas.draw_begin();
        self.canvas
            .clear_rect(0, 0, self.width, self.height, Color::rgba(0, 0, 0, 0));
    }

    pub fn end_frame(&mut self) -> Result<image::RgbaImage> {
        self.canvas.draw_end();
        let gl = self.canvas.renderer().gl();
        let pixels = self.read_pixels_rgba(gl);
        Ok(image::RgbaImage::from_raw(self.width, self.height, pixels).unwrap())
    }

    fn read_pixels_rgba(&self, gl: &glow::Context) -> Vec<u8> {
        let size = (self.width * self.height * 4) as usize;
        let mut pixels = vec![0u8; size];
        unsafe {
            gl.read_pixels(
                0,
                0,
                self.width as i32,
                self.height as i32,
                glow::RGBA,
                glow::UNSIGNED_BYTE,
                glow::PixelPackData::Slice(Some(&mut pixels)),
            );
        }
        // Flip Y
        let mut flipped = vec![0u8; size];
        for y in 0..self.height {
            let src_row = (self.height - 1 - y) as usize * self.width as usize * 4;
            let dst_row = y as usize * self.width as usize * 4;
            flipped[dst_row..dst_row + self.width as usize * 4]
                .copy_from_slice(&pixels[src_row..src_row + self.width as usize * 4]);
        }
        flipped
    }

    pub fn draw_image(&mut self, img: &image::RgbaImage, x: f32, y: f32) -> Result<()> {
        let (w, h) = (img.width(), img.height());
        let img_ref = ImgRef::from_rgba(w, h, img.as_raw()).unwrap();
        let img_id = self.canvas.create_image(img_ref, ImageFlags::empty())?;
        let paint = Paint::image(img_id, 0.0, 0.0, w as f32, h as f32, 0.0, 1.0);
        self.canvas.draw_image(x, y, w as f32, h as f32, paint);
        Ok(())
    }

    pub fn draw_text(
        &mut self,
        x: f32,
        y: f32,
        text: &str,
        size: f32,
        color: Color,
        align: femtovg::Align,
    ) {
        let font_id = self.font_id.expect("Font not loaded");
        let mut paint = Paint::color(color);
        paint.set_text_align(align);
        self.canvas.fill_text(x, y, text, font_id, size, &paint);
    }

    pub fn fill_rect(&mut self, x: f32, y: f32, w: f32, h: f32, paint: &Paint) {
        let mut path = Path::new();
        path.rect(x, y, w, h);
        self.canvas.fill_path(&path, paint);
    }

    pub fn draw_corner_light(&mut self) {
        let center_x = self.width as f32 / 2.0;
        let center_y = self.height as f32 / 2.0;
        let paint = Paint::radial_gradient(
            center_x,
            center_y,
            0.0,
            center_x,
            Color::rgba(255, 255, 255, 200),
            Color::rgba(255, 255, 255, 0),
        );
        let mut path = Path::new();
        path.rect(0.0, 0.0, self.width as f32, self.height as f32);
        self.canvas.fill_path(&path, &paint);
    }
}
