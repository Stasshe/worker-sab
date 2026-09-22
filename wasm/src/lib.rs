#![no_std]

use core::panic::PanicInfo;

const MAX_WIDTH: usize = 1024;
static mut ROW: [u8; MAX_WIDTH * 4] = [0; MAX_WIDTH * 4];

#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    loop {}
}

#[unsafe(no_mangle)]
pub extern "C" fn output_ptr() -> *mut u8 {
    core::ptr::addr_of_mut!(ROW).cast()
}

#[unsafe(no_mangle)]
pub extern "C" fn render_row(row: u32, width: u32, height: u32, max_iterations: u32) {
    if width as usize > MAX_WIDTH {
        return;
    }

    let pixels = unsafe {
        core::slice::from_raw_parts_mut(
            core::ptr::addr_of_mut!(ROW).cast(),
            width as usize * 4,
        )
    };
    let imaginary = row as f64 / height as f64 * 0.0625 + 0.06875;

    for column in 0..width {
        let real = column as f64 / width as f64 * 0.1 - 0.8;
        let mut zx = 0.0;
        let mut zy = 0.0;
        let mut iteration = 0;

        while zx * zx + zy * zy <= 4.0 && iteration < max_iterations {
            let next_real = zx * zx - zy * zy + real;
            zy = 2.0 * zx * zy + imaginary;
            zx = next_real;
            iteration += 1;
        }

        write_color(pixels, column as usize * 4, iteration, max_iterations);
    }
}

fn write_color(pixels: &mut [u8], offset: usize, iteration: u32, max_iterations: u32) {
    if iteration == max_iterations {
        pixels[offset] = 8;
        pixels[offset + 1] = 13;
        pixels[offset + 2] = 29;
        pixels[offset + 3] = 255;
        return;
    }

    pixels[offset] = (iteration * 9 % 256) as u8;
    pixels[offset + 1] = ((iteration * 3 + 40) % 256) as u8;
    pixels[offset + 2] = ((iteration * 13 + 90) % 256) as u8;
    pixels[offset + 3] = 255;
}
