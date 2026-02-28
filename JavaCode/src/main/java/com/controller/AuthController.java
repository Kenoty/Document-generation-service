package com.controller;

import com.dto.AuthRequest;
import com.dto.AuthResponse;
import com.model.User;
import com.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class AuthController {

    @Autowired
    private UserService userService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthRequest authRequest, HttpServletRequest request) {
        try {
            User user = userService.createUser(
                    authRequest.getUsername(),
                    authRequest.getUsername() + "@example.com",
                    authRequest.getPassword()
            );

            // Создаем сессию
            HttpSession session = request.getSession();
            session.setAttribute("user", user);

            AuthResponse response = new AuthResponse(user.getUsername(), user.getEmail());
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest authRequest, HttpServletRequest request) {
        try {

            // Всегда получаем свежего пользователя из БД
            User user = userService.findByUsername(authRequest.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            if (!userService.validatePassword(authRequest.getPassword(), user.getPassword())) {
                return ResponseEntity.status(401).body("Invalid password");
            }

            // Инвалидируем старую сессию если есть
            HttpSession oldSession = request.getSession(false);
            if (oldSession != null) {
                oldSession.invalidate();
            }

            // Создаем новую сессию с актуальными данными из БД
            HttpSession newSession = request.getSession(true);
            newSession.setAttribute("user", user);

            AuthResponse response = new AuthResponse(user.getUsername(), user.getEmail());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Invalid credentials");
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            String username = "unknown";
            User user = (User) session.getAttribute("user");
            if (user != null) {
                username = user.getUsername();
            }
            session.invalidate();
        }
        return ResponseEntity.ok("Logout successful");
    }

    @GetMapping("/current-user")
    public ResponseEntity<?> getCurrentUser(HttpServletRequest request) {
        HttpSession session = request.getSession(false);

        if (session != null) {
            User sessionUser = (User) session.getAttribute("user");

            if (sessionUser != null) {
                // Всегда проверяем актуальность пользователя в БД
                Optional<User> dbUser = userService.findByUsername(sessionUser.getUsername());
                if (dbUser.isPresent()) {
                    User freshUser = dbUser.get();

                    // Если данные устарели, обновляем сессию
                    if (!isUserDataCurrent(sessionUser, freshUser)) {
                        session.setAttribute("user", freshUser);
                    }

                    AuthResponse response = new AuthResponse(freshUser.getUsername(), freshUser.getEmail());
                    return ResponseEntity.ok(response);
                } else {
                    // Пользователь удален из БД
                    session.invalidate();
                    return ResponseEntity.status(401).body("User not found");
                }
            }
        }
        return ResponseEntity.status(401).body("Not authenticated");
    }

    private boolean isUserDataCurrent(User sessionUser, User dbUser) {
        return sessionUser.getEmail().equals(dbUser.getEmail()) &&
                sessionUser.getUsername().equals(dbUser.getUsername());
    }

    @PostMapping("/refresh-session")
    public ResponseEntity<?> refreshSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return ResponseEntity.status(401).body("No active session");
        }

        User sessionUser = (User) session.getAttribute("user");
        if (sessionUser == null) {
            return ResponseEntity.status(401).body("No user in session");
        }

        Optional<User> dbUser = userService.findByUsername(sessionUser.getUsername());
        if (dbUser.isPresent()) {
            User freshUser = dbUser.get();
            session.setAttribute("user", freshUser);

            AuthResponse response = new AuthResponse(freshUser.getUsername(), freshUser.getEmail());
            return ResponseEntity.ok(response);
        } else {
            session.invalidate();
            return ResponseEntity.status(401).body("User not found");
        }
    }
}