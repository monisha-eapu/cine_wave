package com.movieticketbooking;

import javax.swing.*;
import java.awt.*;

/**
 * Main Entry Point for Movie Ticket Booking System - Java Swing Application
 * Prepared by: Monisha (Centurion University)
 */
public class MainApp {
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            try {
                // Set System Look & Feel
                UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
            } catch (Exception ignored) {}

            JFrame frame = new JFrame("CineWave - Movie Ticket Booking System");
            frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            frame.setSize(1100, 750);
            frame.setLocationRelativeTo(null);

            JPanel root = new JPanel(new BorderLayout());
            root.setBackground(new Color(15, 23, 42));

            JLabel title = new JLabel("🎬 CineWave Movie Ticket Booking System", SwingConstants.CENTER);
            title.setFont(new Font("Segoe UI", Font.BOLD, 26));
            title.setForeground(new Color(244, 63, 94));
            title.setBorder(BorderFactory.createEmptyBorder(20, 10, 10, 10));

            JLabel info = new JLabel("<html><center>CineWave Java web backend: <b style='color:#38bdf8;'>http://localhost:3000</b><br><br>The website frontend is served by Spring Boot. This original Swing display is retained separately; run the Main class to start the web server.</center></html>", SwingConstants.CENTER);
            info.setFont(new Font("Segoe UI", Font.PLAIN, 16));
            info.setForeground(Color.WHITE);

            root.add(title, BorderLayout.NORTH);
            root.add(info, BorderLayout.CENTER);

            frame.add(root);
            frame.setVisible(true);
        });
    }
}
